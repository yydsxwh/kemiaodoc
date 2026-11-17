import { NextResponse } from "next/server";
import { accountLogoutAction, readAccountOidcEnv } from "@andyyyds/shared/account-oidc";
import { clearSessionCookie } from "@andyyyds/shared/auth-session-cookie";
import { TAB_HEADER } from "@andyyyds/shared/tab-decision";
import { listWwwAccounts, updateWwwTab } from "@andyyyds/shared/www-tab-broker";
import { getPublicSiteUrl } from "@andyyyds/shared/payments";
import { getRequestPublicOrigin } from "@andyyyds/shared/request-origin";

export const dynamic = "force-dynamic";

const OPS = new Set(["resume", "select", "role", "logout-tab", "remove-account", "logout-browser"]);

function privateJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
}

export async function GET() {
  const accounts = await listWwwAccounts();
  return privateJson({ accounts });
}

export async function POST(request: Request) {
  let body: { op?: string; role?: string; sessionId?: string; cloneFrom?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (!body.op || !OPS.has(body.op)) {
    return privateJson({ error: "不支持的操作" }, 400);
  }
  const result = await updateWwwTab({
    op: body.op as "resume" | "select" | "role" | "logout-tab" | "remove-account" | "logout-browser",
    role: body.role,
    sessionId: body.sessionId,
    cloneFrom: body.cloneFrom,
    tabHeader: request.headers.get(TAB_HEADER),
  });
  const legacyLogout =
    !result.applied &&
    result.reason === "no-device" &&
    (body.op === "logout-tab" || body.op === "remove-account" || body.op === "logout-browser");
  if (!result.applied && !legacyLogout) {
    return privateJson(
      {
        ...result,
        error: "没有改动任何登录。请在这个标签页里重试，其他标签页不会被退出。",
      },
      400,
    );
  }
  let continueTo = "";
  if (legacyLogout || body.op === "logout-browser") {
    const env = readAccountOidcEnv();
    if (env) {
      const origin = getRequestPublicOrigin(request) || (await getPublicSiteUrl());
      const dest = new URL(accountLogoutAction(env.issuer));
      dest.searchParams.set("next", origin.endsWith("/") ? origin : `${origin}/`);
      continueTo = dest.toString();
    }
  }
  const response = privateJson({
    ...result,
    applied: true,
    status: legacyLogout ? "anonymous" : result.status,
    ...(continueTo ? { continueTo } : {}),
  });
  if (legacyLogout) clearSessionCookie(response.cookies);
  return response;
}
