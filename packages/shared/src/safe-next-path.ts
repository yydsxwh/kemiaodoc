/**
 * 主站登录回跳校验。
 *
 * 只接受站内相对路径。禁止 //evil、反斜杠、带协议的伪路径、登录循环地址。
 * URL 解析会把反斜杠当成斜杠，`/\\evil.com` 会变成 https://evil.com。
 */

const MAX_NEXT_LENGTH = 500;
const SAFE_NEXT_ORIGIN = "https://yydsxwh.com";

function hasControlChar(value: string): boolean {
  return /[\u0000-\u001F\u007F]/.test(value);
}

function staysOnSafeOrigin(value: string): boolean {
  if (value.includes("\\") || value.includes("://") || hasControlChar(value)) return false;
  const pathOnly = value.split("?")[0] || "";
  let decodedPath = pathOnly;
  try {
    decodedPath = decodeURIComponent(pathOnly);
  } catch {
    return false;
  }
  if (
    !decodedPath.startsWith("/") ||
    decodedPath.startsWith("//") ||
    decodedPath.includes("\\") ||
    decodedPath.includes("://") ||
    hasControlChar(decodedPath)
  ) {
    return false;
  }
  try {
    const url = new URL(value, SAFE_NEXT_ORIGIN);
    return url.origin === SAFE_NEXT_ORIGIN && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  const value = (raw || "").trim();
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (!staysOnSafeOrigin(value)) return fallback;
  const pathOnly = value.split("?")[0] || "";
  if (isAuthLoopPath(pathOnly)) return fallback;
  return value.slice(0, MAX_NEXT_LENGTH) || fallback;
}

export function isAuthLoopPath(pathname: string): boolean {
  const path = (pathname || "").split("?")[0] || "";
  if (path === "/login" || path === "/register") return true;
  return path === "/api/auth" || path.startsWith("/api/auth/");
}

/** 顶栏登录/注册：把当前页做成 next，避免固定跳个人中心 */
export function nextFromCurrentLocation(pathname: string | null | undefined, search = ""): string {
  const path = (pathname || "/").trim() || "/";
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  const query = search && !search.startsWith("?") ? `?${search}` : search;
  return safeNextPath(`${path}${query || ""}`);
}
