/**
 * 账号中心跳转页。
 *
 * iPhone 微信会丢掉「空正文的 307 + Set-Cookie」跨站跳转，页面停在原地，
 * 看起来像登录按钮没有反应。这里改成普通文档：先写下主站事务 Cookie，
 * 再用 meta refresh 和可见链接离开。不依赖脚本才能继续。
 */

export function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function authHandoffDocument(location: string) {
  const href = escapeHtmlAttr(location);
  const body = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${href}"><title>正在打开账号中心</title></head><body><p><a href="${href}">继续前往账号中心</a></p></body></html>`;
  return {
    status: 200 as const,
    contentType: "text/html; charset=utf-8",
    cacheControl: "private, no-store",
    body,
  };
}
