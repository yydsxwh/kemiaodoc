/**
 * 登录会话（JWT Cookie）
 *
 * Cookie 名：yyds_session。角色在 role（主角色）+ roles（多角色列表）。
 * 校验 JWT 后会回查用户表，保证站长改角色后无需重新登录即可生效。
 * 需要登录的 API / 页面先 getSession()，没有则 401 或跳转 /login。
 *
 * 新登录走 account OIDC，跨产品主键是 accountSub=usr_xxx。
 * 本地 User.id 只给本站业务表用，不再当身份源。
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  applySessionCookie,
  clearSessionCookie,
  isSessionEpochValid,
} from "./auth-session-cookie";
import { prisma } from "./db";
import { hashPassword, makeReferralCode, verifyPassword } from "./password";
import {
  canManageCourses,
  isRoleApplicationPending,
  normalizeRoles,
  primaryRole,
  type Role,
} from "./roles";

export { hashPassword, makeReferralCode, verifyPassword };
export {
  SESSION_COOKIE_NAME,
  sessionCookieClearOptions,
  sessionCookieWriteOptions,
} from "./auth-session-cookie";

export type SessionUser = {
  id: string;
  /**
   * account OIDC sub（usr_xxx）。跨产品主键。
   * 旧本地账号尚未联邦时为空字符串，业务仍用下方本地 id。
   */
  accountSub: string;
  /** 来自 account 投影的 KK 号；未挂钩时可能仍是主站历史字段 */
  kkNumber: number | null;
  email: string;
  name: string;
  /** 主角色（优先级最高）；分成比例等仍可读此字段 */
  role: Role;
  /** 全部角色；权限判定优先用此列表 */
  roles: Role[];
  /** 头像：OSS/本地路径或微信 CDN；展示前需 resolveStoredAccessUrl */
  avatarUrl: string;
  /** 注册申请角色（待审核时有值） */
  requestedRole: string;
  roleApplicationStatus: string;
  /** 是否有待站长审核的角色申请 */
  rolePending: boolean;
  /** 大学论坛最近进入/认证的高校分区；空表示尚未加入 */
  forumUniversityId: string;
  /** 本科/研究生实名认证已通过的高校 id */
  forumVerifiedUniversityIds: string[];
  forumSchoolSlots: Array<{
    degreeLevel: string;
    universityId: string;
    status: string;
  }>;
  /** 当前标签页工作台。多账号时 roles 只含这一项 */
  activeRole?: Role | null;
  grantedRoles?: Role[];
};

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is missing");
  return new TextEncoder().encode(secret);
}

export async function createSession(
  user: Pick<SessionUser, "id" | "email" | "name" | "role">,
) {
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { sessionEpoch: true },
  });
  const token = await new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    sv: current?.sessionEpoch ?? 0,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());

  const { linkWwwLogin, multiAccountTabsEnabled } = await import("./www-tab-broker");
  if (!multiAccountTabsEnabled()) {
    const jar = await cookies();
    applySessionCookie(jar, token);
    return;
  }
  const linked = await linkWwwLogin(token, user.id);
  if (linked.mode !== "parallel") {
    const jar = await cookies();
    applySessionCookie(jar, token);
  }
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const id = String(payload.id || "");
      if (id) {
        await prisma.user.update({
          where: { id },
          data: { sessionEpoch: { increment: 1 } },
        });
      }
    } catch {
      // 过期/伪造 token 仍要清 Cookie；用户不存在时也不阻断登出
    }
  }
  clearSessionCookie(jar);
}

export async function getSession(): Promise<SessionUser | null> {
  const { readWwwTabHit } = await import("./www-tab-broker");
  const hit = await readWwwTabHit();
  if (hit.kind === "anonymous" || hit.kind === "ambiguous") return null;
  if (hit.kind === "ready") return sessionFromToken(hit.token, hit.permissionRoles);
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const id = String(payload.id);
    // 以数据库角色为准，避免站长改角色后 JWT 仍是旧值
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        accountSub: true,
        kkNumber: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        avatarUrl: true,
        requestedRole: true,
        roleApplicationStatus: true,
        sessionEpoch: true,
        forumUniversityId: true,
        forumSchoolVerifications: {
          select: {
            universityId: true,
            degreeLevel: true,
            status: true,
          },
        },
      },
    });
    if (!user) return null;
    if (!isSessionEpochValid(payload.sv, user.sessionEpoch)) return null;
    return sessionFromUser(user, null);
  } catch {
    return null;
  }
}

async function sessionFromToken(token: string, permissionRoles: Role[]): Promise<SessionUser | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    const id = String(payload.id || "");
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        accountSub: true,
        kkNumber: true,
        email: true,
        name: true,
        role: true,
        roles: true,
        avatarUrl: true,
        requestedRole: true,
        roleApplicationStatus: true,
        sessionEpoch: true,
        forumUniversityId: true,
        forumSchoolVerifications: {
          select: { universityId: true, degreeLevel: true, status: true },
        },
      },
    });
    if (!user || !isSessionEpochValid(payload.sv, user.sessionEpoch)) return null;
    return sessionFromUser(user, permissionRoles);
  } catch {
    return null;
  }
}

function sessionFromUser(
  user: {
    id: string;
    accountSub: string | null;
    kkNumber: number | null;
    email: string;
    name: string;
    role: string;
    roles: string;
    avatarUrl: string;
    requestedRole: string;
    roleApplicationStatus: string;
    forumUniversityId: string | null;
    forumSchoolVerifications: Array<{ universityId: string; degreeLevel: string; status: string }>;
  },
  permissionRoles: Role[] | null,
): SessionUser {
    const roles = normalizeRoles({
      role: user.role,
      roles: user.roles || "",
    });
    const narrowed = permissionRoles?.filter((role) => roles.includes(role)) ?? null;
    const effective = narrowed && narrowed.length > 0 ? narrowed : roles;
    const forumSchoolSlots = (user.forumSchoolVerifications || []).map(
      (row) => ({
        degreeLevel: row.degreeLevel,
        universityId: row.universityId,
        status: row.status,
      }),
    );
    const active = primaryRole(effective);
    return {
      id: user.id,
      accountSub: user.accountSub || "",
      kkNumber: user.kkNumber ?? null,
      email: user.email,
      name: user.name,
      role: permissionRoles ? active : primaryRole(roles),
      roles: permissionRoles ? effective : roles,
      avatarUrl: user.avatarUrl || "",
      requestedRole: user.requestedRole || "",
      roleApplicationStatus: user.roleApplicationStatus || "NONE",
      rolePending: isRoleApplicationPending(user.roleApplicationStatus || ""),
      forumUniversityId: user.forumUniversityId || "",
      forumVerifiedUniversityIds: [
        ...new Set(
          forumSchoolSlots
            .filter((row) => row.status === "VERIFIED")
            .map((row) => row.universityId),
        ),
      ],
      forumSchoolSlots,
      activeRole: permissionRoles ? active : null,
      grantedRoles: roles,
    };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

/** 课程/素材创作者（站长、加盟代理、老师、入驻商家） */
export async function requireTeacher() {
  const session = await requireUser();
  if (!canManageCourses(session)) {
    throw new Error("FORBIDDEN");
  }
  return session;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.id } });
}
