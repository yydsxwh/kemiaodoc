/**
 * 分享是否有效、访客能看见哪些文档。
 * 知识库分享只放开作者勾选的文档，归入同一空间不会自动公开。
 */

import { createHash, randomBytes } from "node:crypto";

export const DOCS_SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,80}$/;
export const DOCS_MEDIA_SIGN_TTL_SEC = 20 * 60;

export type DocsShareScope = "document" | "space";

export type DocsShareGrant = {
  scope: DocsShareScope;
  documentId: string | null;
  spaceId: string | null;
  documentIds: readonly string[];
  expiresAt: string | null;
  revokedAt: string | null;
};

export function createShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashShareToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isShareToken(value: unknown): value is string {
  return typeof value === "string" && DOCS_SHARE_TOKEN_PATTERN.test(value);
}

export function shareIsActive(share: DocsShareGrant, now = Date.now()): boolean {
  if (share.revokedAt) return false;
  if (!share.expiresAt) return true;
  const expires = new Date(share.expiresAt).getTime();
  return Number.isFinite(expires) && expires > now;
}

export function visibleSharedDocumentIds(
  share: DocsShareGrant,
  existingDocumentIds: readonly string[],
  now = Date.now(),
): string[] {
  if (!shareIsActive(share, now)) return [];
  const existing = new Set(existingDocumentIds);
  if (share.scope === "document") {
    return share.documentId && existing.has(share.documentId) ? [share.documentId] : [];
  }
  const selected = new Set(share.documentIds);
  return existingDocumentIds.filter((id) => selected.has(id));
}

export function shareAllowsDocument(
  share: DocsShareGrant,
  documentId: string,
  existingDocumentIds: readonly string[],
  now = Date.now(),
): boolean {
  return visibleSharedDocumentIds(share, existingDocumentIds, now).includes(documentId);
}

export function parseShareDocumentIds(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const item of list) {
    const id = String(item || "").trim();
    if (!/^[a-z0-9]{8,40}$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function documentContainsMediaSrc(
  content: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] },
  src: string,
): boolean {
  if (!src) return false;
  if (content.type === "image" && String(content.attrs?.src || "") === src) return true;
  const children = Array.isArray(content.content) ? content.content : [];
  return children.some((child) =>
    child && typeof child === "object"
      ? documentContainsMediaSrc(child as { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }, src)
      : false,
  );
}

/** 作者刚上传、尚未写入正文的图片，只允许签自己的上传目录。 */
export function userOwnsUploadUrl(userId: string, src: string): boolean {
  if (!/^[a-z0-9]{8,40}$/i.test(userId)) return false;
  if (src.startsWith("/uploads/")) {
    const parts = src.split("/");
    return parts[2] === userId && !src.includes("..");
  }
  try {
    const url = new URL(src);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.includes(userId);
  } catch {
    return false;
  }
}

export function mediaSrcAllowedForReader(input: {
  src: string;
  userId?: string | null;
  contents?: readonly { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }[];
}): boolean {
  if (!input.src || input.src.startsWith("data:") || input.src.startsWith("blob:")) return false;
  if (input.contents?.some((content) => documentContainsMediaSrc(content, input.src))) return true;
  if (input.userId && userOwnsUploadUrl(input.userId, input.src)) return true;
  return false;
}
