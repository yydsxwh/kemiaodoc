/**
 * 主站多账号。会话 JWT 放在每枚账号自己的 HttpOnly Cookie 里，
 * 标签页只通过上下文 id 选择其中一枚。
 */

import { createHash, randomBytes } from "node:crypto";
import { jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import { primaryRole, normalizeRoles, type Role } from "./roles";
import {
  DEVICE_COOKIE,
  TAB_HEADER,
  holdCookieName,
  isTabContextId,
  multiAccountTabsEnabled,
  planAddAccount,
  planLogout,
  planRoleSwitch,
  resolveAccess,
  type AccountRecord,
  type BrokerState,
} from "./tab-decision";

export { TAB_HEADER, multiAccountTabsEnabled };

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hostCookie(maxAge: number) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

async function loadState(deviceId: string): Promise<BrokerState> {
  const device = await prisma.wwwBrowserDevice.findUnique({
    where: { id: deviceId },
    include: {
      accounts: { where: { revokedAt: null }, include: { user: true } },
      tabs: { where: { revokedAt: null } },
    },
  });
  if (!device || device.revokedAt) {
    return { explicitPick: false, defaultSessionId: null, accounts: [], tabs: [] };
  }
  const accounts: AccountRecord[] = device.accounts.map((row) => {
    const granted = normalizeRoles({ role: row.user.role, roles: row.user.roles || "" }).map(String);
    return {
      sessionId: row.holdId,
      userId: row.userId,
      active: true,
      grantedRoles: granted,
      defaultRole: granted.length ? primaryRole({ role: row.user.role, roles: row.user.roles || "" }) : null,
      pendingReview: false,
      authTimeSec: Math.floor(row.createdAt.getTime() / 1000),
      display: {
        name: row.user.name,
        kkNumber: row.user.kkNumber != null ? String(row.user.kkNumber) : null,
        emailMasked: "",
        phoneMasked: "",
        avatarUrl: row.user.avatarUrl || "",
        subHint: row.user.accountSub || "",
      },
    };
  });
  return {
    explicitPick: device.explicitPick,
    defaultSessionId: null,
    accounts,
    tabs: device.tabs.map((tab) => ({
      contextId: tab.id,
      sessionId: tab.holdId || null,
      activeRole: tab.activeRole,
      revoked: false,
    })),
  };
}

async function currentDevice() {
  const jar = await cookies();
  const token = jar.get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const row = await prisma.wwwBrowserDevice.findUnique({
    where: { tokenHash: hashValue(token) },
    select: { id: true, revokedAt: true },
  });
  if (!row) return null;
  if (row.revokedAt) return { id: "", revoked: true };
  return { id: row.id, revoked: false };
}

export async function linkWwwLogin(token: string, userId: string) {
  if (!multiAccountTabsEnabled()) return { mode: "legacy" as const };
  let device = await currentDevice();
  const jar = await cookies();
  if (!device || device.revoked) {
    const deviceToken = randomBytes(32).toString("base64url");
    const created = await prisma.wwwBrowserDevice.create({
      data: { tokenHash: hashValue(deviceToken) },
      select: { id: true },
    });
    jar.set(DEVICE_COOKIE, deviceToken, hostCookie(60 * 60 * 24 * 180));
    device = { id: created.id, revoked: false };
  }
  const holdId = randomBytes(16).toString("base64url");
  const previous = await prisma.wwwDeviceAccount.findUnique({
    where: { deviceId_userId: { deviceId: device.id, userId } },
  });
  if (previous) {
    await prisma.wwwTabContext.updateMany({
      where: { deviceId: device.id, holdId: previous.holdId, revokedAt: null },
      data: { holdId },
    });
    await prisma.wwwDeviceAccount.update({
      where: { id: previous.id },
      data: { holdId, tokenHash: hashValue(token), revokedAt: null },
    });
    jar.set(holdCookieName(previous.holdId), "", hostCookie(0));
  } else {
    await prisma.wwwDeviceAccount.create({
      data: { deviceId: device.id, userId, holdId, tokenHash: hashValue(token) },
    });
  }
  jar.set(holdCookieName(holdId), token, hostCookie(60 * 60 * 24 * 30));
  const state = await loadState(device.id);
  const added = state.accounts.find((account) => account.sessionId === holdId);
  const tab = (await headers()).get(TAB_HEADER);
  if (added) {
    const plan = planAddAccount(
      { ...state, accounts: state.accounts.filter((account) => account.userId !== userId) },
      { contextId: tab, account: added },
    );
    if (plan.state.explicitPick) {
      await prisma.wwwBrowserDevice.update({ where: { id: device.id }, data: { explicitPick: true } });
    }
    for (const mutation of plan.mutations) {
      if (mutation.op !== "bind" || !isTabContextId(mutation.contextId)) continue;
      const existing = await prisma.wwwTabContext.findUnique({ where: { id: mutation.contextId } });
      if (existing && existing.deviceId !== device.id) continue;
      await prisma.wwwTabContext.upsert({
        where: { id: mutation.contextId },
        create: {
          id: mutation.contextId,
          deviceId: device.id,
          holdId: mutation.sessionId,
          activeRole: mutation.activeRole,
        },
        update: { holdId: mutation.sessionId, activeRole: mutation.activeRole, revokedAt: null },
      });
    }
  }
  const alive = (await loadState(device.id)).accounts.filter((account) => account.active);
  return { mode: alive.length > 1 ? ("parallel" as const) : ("single" as const) };
}

export type WwwTabHit = {
  kind: "legacy" | "anonymous" | "ambiguous";
} | {
  kind: "ready";
  userId: string;
  token: string;
  activeRole: Role | null;
  permissionRoles: Role[];
};

export async function readWwwTabHit(): Promise<WwwTabHit> {
  if (!multiAccountTabsEnabled()) return { kind: "legacy" };
  const device = await currentDevice();
  if (!device) return { kind: "legacy" };
  if (!device.id) return { kind: "anonymous" };
  const tab = (await headers()).get(TAB_HEADER);
  const state = await loadState(device.id);
  const decision = resolveAccess(state, { tabHeader: tab });
  if (decision.kind !== "ready") return { kind: decision.kind === "ambiguous" ? "ambiguous" : "anonymous" };
  const jar = await cookies();
  const token = jar.get(holdCookieName(decision.account.sessionId))?.value;
  if (!token) return { kind: "anonymous" };
  const row = await prisma.wwwDeviceAccount.findFirst({
    where: { holdId: decision.account.sessionId, revokedAt: null, deviceId: device.id },
    select: { tokenHash: true },
  });
  if (!row || row.tokenHash !== hashValue(token)) return { kind: "anonymous" };
  const secret = process.env.AUTH_SECRET;
  if (!secret) return { kind: "anonymous" };
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (String(payload.id || "") !== decision.account.userId) return { kind: "anonymous" };
  } catch {
    return { kind: "anonymous" };
  }
  const roles = decision.permissionRoles.filter((role): role is Role =>
    ["ADMIN", "AGENT", "MERCHANT", "TEACHER", "STUDENT"].includes(role),
  );
  return {
    kind: "ready",
    userId: decision.account.userId,
    token,
    activeRole: (decision.activeRole as Role | null) ?? null,
    permissionRoles: roles,
  };
}

export async function updateWwwTab(input: { op: "logout-tab" | "role"; role?: string }) {
  const device = await currentDevice();
  const tab = (await headers()).get(TAB_HEADER);
  if (!device?.id || !isTabContextId(tab)) return { ok: false };
  const state = await loadState(device.id);
  if (input.op === "role") {
    const plan = planRoleSwitch(state, { contextId: tab, role: input.role || "" });
    for (const mutation of plan.mutations) {
      if (mutation.op === "bind") {
        await prisma.wwwTabContext.updateMany({
          where: { id: tab, deviceId: device.id },
          data: { activeRole: mutation.activeRole },
        });
      }
    }
    return { ok: true };
  }
  const plan = planLogout(state, { scope: "tab", contextId: tab });
  for (const mutation of plan.mutations) {
    if (mutation.op === "clear-tab") {
      await prisma.wwwTabContext.updateMany({
        where: { id: mutation.contextId, deviceId: device.id },
        data: { revokedAt: new Date(), holdId: "" },
      });
    }
  }
  return { ok: true };
}
