/**
 * 主站同一进程里的账号中心客户端选择。
 *
 * www 与 course 共用账号中心和回调地址，但 client_id 不同。
 * 这里只做白名单和路径判断，不读取 Client Secret，方便顶栏等客户端组件引用。
 */

import { safeNextPath } from "./safe-next-path";

export const ACCOUNT_CLIENT_KEYS = ["www", "course"] as const;

export type AccountClientKey = (typeof ACCOUNT_CLIENT_KEYS)[number];

export const ACCOUNT_LOGIN_UNCONFIGURED_MESSAGE = "登录服务暂未完成配置";
export const ACCOUNT_LOGIN_INVALID_CLIENT_MESSAGE =
  "登录入口无效，请从页面重新进入";

/**
 * 网课资料现有页面。必须整段匹配，避免 /courses-x 或 /studio/media-library
 * 被误判成 course。
 */
const COURSE_RETURN_PREFIXES = [
  "/courses",
  "/materials",
  "/learn",
  "/studio/courses",
  "/studio/materials",
  "/studio/media",
  "/studio/compose",
] as const;

export function parseAccountClientKey(
  raw: string | null | undefined,
): AccountClientKey | null {
  const value = String(raw || "").trim();
  if (value === "www" || value === "course") return value;
  return null;
}

export function returnPathname(returnTo: string | null | undefined): string {
  const safe = safeNextPath(returnTo);
  const path = (safe.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  return path;
}

/** 没有显式 client 时，用回跳路径决定产品。其它页面保持主站 www。 */
export function accountClientKeyForReturnTo(
  returnTo: string | null | undefined,
): AccountClientKey {
  const path = returnPathname(returnTo);
  for (const prefix of COURSE_RETURN_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return "course";
  }
  return "www";
}

export type AccountClientSelection =
  | { ok: true; key: AccountClientKey; source: "explicit" | "returnTo" }
  | { ok: false; reason: "invalid-client" };

/**
 * 显式 client 优先，且只接受白名单。非法值直接失败，不能拿去拼环境变量名。
 * 未显式指定时才按 returnTo 兜底。
 */
export function resolveAccountClientSelection(input: {
  explicit?: string | null;
  returnTo?: string | null;
}): AccountClientSelection {
  const raw = String(input.explicit || "").trim();
  if (raw) {
    const key = parseAccountClientKey(raw);
    if (!key) return { ok: false, reason: "invalid-client" };
    return { ok: true, key, source: "explicit" };
  }
  return {
    ok: true,
    key: accountClientKeyForReturnTo(input.returnTo),
    source: "returnTo",
  };
}

export function accountAuthStartPath(input: {
  mode: "login" | "register";
  returnTo: string;
  client: AccountClientKey;
  ref?: string;
}): string {
  const next = safeNextPath(input.returnTo);
  const params = new URLSearchParams();
  params.set("mode", input.mode);
  params.set("next", next);
  params.set("client", input.client);
  const ref = (input.ref || "").trim();
  if (ref) params.set("ref", ref.slice(0, 32));
  return `/api/auth/account/start?${params.toString()}`;
}

/** 站内登录入口：带上原页面，并按该页面写明 client。 */
export function accountLoginPath(returnTo: string): string {
  const next = safeNextPath(returnTo);
  const client = accountClientKeyForReturnTo(next);
  const params = new URLSearchParams();
  if (next !== "/") params.set("next", next);
  params.set("client", client);
  return `/login?${params.toString()}`;
}

export function accountRegisterPath(returnTo: string, ref = ""): string {
  const next = safeNextPath(returnTo);
  const client = accountClientKeyForReturnTo(next);
  const params = new URLSearchParams();
  if (next !== "/") params.set("next", next);
  params.set("client", client);
  const code = ref.trim();
  if (code) params.set("ref", code.slice(0, 32));
  return `/register?${params.toString()}`;
}
