/**
 * 分享凭证只授予只读范围。
 * 单篇分享看不到同空间的其他文档；知识库分享只包含作者勾选的文档。
 */

import { prisma } from "@andyyyds/shared/db";
import {
  DOCS_MEDIA_SIGN_TTL_SEC,
  documentContainsMediaSrc,
  hashShareToken,
  isShareToken,
  parseShareDocumentIds,
  shareAllowsDocument,
  shareIsActive,
  visibleSharedDocumentIds,
  createShareToken,
  type DocsShareGrant,
} from "@andyyyds/docs/lib/docs-access";
import {
  parseStoredDocument,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import { sharePath, type DocsShareView } from "@andyyyds/docs/lib/docs-library";
import { buildSearchSnippet, normalizeSearchQuery, type DocsSearchSnippet } from "@andyyyds/docs/lib/docs-search";
import { DocsWikiError } from "@andyyyds/docs/lib/docs-wiki-store";

const SHARE_NOTICE = "这是已保存内容的实时分享。作者保存后，这个页面会跟着更新。";
const PUBLIC_CLOSED = "这个分享链接现在打不开。";

export class DocsShareClosedError extends Error {
  constructor() {
    super(PUBLIC_CLOSED);
    this.name = "DocsShareClosedError";
  }
}

export type DocsPublicDocument = {
  id: string;
  title: string;
  updatedAt: string;
};

export type DocsPublicPayload = {
  scope: "document" | "space";
  version: number;
  notice: string;
  expiresAt: string | null;
  spaceName: string | null;
  watermark: { text: string; opacity: number; onPrint: boolean };
  mediaExpiresInSec: number;
  documents: DocsPublicDocument[];
  tags: { name: string; count: number }[];
  breadcrumb: { label: string }[];
  document: DocsDocumentPayload | null;
  media: Record<string, string>;
};

type ShareRow = {
  id: string;
  userId: string;
  scope: string;
  documentId: string | null;
  spaceId: string | null;
  token: string;
  documentIds: string;
  expiresAt: Date | null;
  revokedAt: Date | null;
  version: number;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkOnPrint: boolean;
  updatedAt: Date;
};

function storedDocumentIds(raw: string): string[] {
  try {
    return parseShareDocumentIds(JSON.parse(raw || "[]"));
  } catch {
    return [];
  }
}

function grantOf(row: ShareRow): DocsShareGrant {
  return {
    scope: row.scope === "space" ? "space" : "document",
    documentId: row.documentId,
    spaceId: row.spaceId,
    documentIds: storedDocumentIds(row.documentIds),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

function clampOpacity(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0.12;
  return Math.min(0.2, Math.max(0.04, value));
}

function clampWatermark(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
}

function expiryFromDays(days: unknown): Date | null {
  if (days === null || days === undefined || days === "" || days === 0) return null;
  const count = Number(days);
  if (!Number.isFinite(count) || count < 0) return null;
  if (count === 0) return null;
  const rounded = Math.min(365, Math.round(count));
  if (!rounded) return null;
  return new Date(Date.now() + rounded * 24 * 60 * 60 * 1000);
}

async function toView(row: ShareRow): Promise<DocsShareView> {
  const grant = grantOf(row);
  const space = row.spaceId
    ? await prisma.docsSpace.findFirst({
        where: { id: row.spaceId, userId: row.userId },
        select: { name: true },
      })
    : null;
  return {
    id: row.id,
    scope: grant.scope,
    documentId: row.documentId,
    spaceId: row.spaceId,
    spaceName: space?.name || "",
    documentIds: [...grant.documentIds],
    token: row.token,
    path: sharePath(row.token, grant.scope === "space" ? grant.documentIds[0] : null),
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt,
    version: row.version,
    watermarkText: row.watermarkText,
    watermarkOpacity: row.watermarkOpacity,
    watermarkOnPrint: row.watermarkOnPrint,
    active: shareIsActive(grant),
  };
}

export async function listDocsShares(userId: string, filter?: { documentId?: string; spaceId?: string }) {
  const rows = await prisma.docsShare.findMany({
    where: {
      userId,
      ...(filter?.documentId ? { documentId: filter.documentId } : {}),
      ...(filter?.spaceId ? { spaceId: filter.spaceId } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
  const views = [];
  for (const row of rows) views.push(await toView(row));
  return views;
}

async function ownedDocumentIds(userId: string, ids: readonly string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.docsDocument.findMany({
    where: { userId, id: { in: [...ids] } },
    select: { id: true },
  });
  const found = new Set(rows.map((row) => row.id));
  return ids.filter((id) => found.has(id));
}

async function documentsInSpace(userId: string, spaceId: string): Promise<string[]> {
  const rows = await prisma.docsNode.findMany({
    where: { userId, spaceId, kind: "document", status: "active", documentId: { not: null } },
    select: { documentId: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map((row) => row.documentId).filter((id): id is string => Boolean(id));
}

export async function openDocsShare(
  userId: string,
  input: {
    scope: "document" | "space";
    documentId?: string | null;
    spaceId?: string | null;
    documentIds?: unknown;
    expiresInDays?: unknown;
    watermarkText?: unknown;
    watermarkOpacity?: unknown;
    watermarkOnPrint?: unknown;
  },
) {
  const scope = input.scope === "space" ? "space" : "document";
  let documentId: string | null = null;
  let spaceId: string | null = null;
  let documentIds: string[] = [];
  if (scope === "document") {
    documentId = String(input.documentId || "");
    const doc = await prisma.docsDocument.findFirst({
      where: { id: documentId, userId },
      select: { id: true },
    });
    if (!doc) throw new DocsWikiError("找不到这篇文档", 404);
  } else {
    spaceId = String(input.spaceId || "");
    const space = await prisma.docsSpace.findFirst({
      where: { id: spaceId, userId },
      select: { id: true },
    });
    if (!space) throw new DocsWikiError("找不到这个知识库", 404);
    const placed = new Set(await documentsInSpace(userId, spaceId));
    documentIds = (await ownedDocumentIds(userId, parseShareDocumentIds(input.documentIds))).filter((id) =>
      placed.has(id),
    );
  }
  const existing = await prisma.docsShare.findFirst({
    where: {
      userId,
      scope,
      documentId,
      spaceId,
      revokedAt: null,
    },
    orderBy: { updatedAt: "desc" },
  });
  if (existing && shareIsActive(grantOf(existing))) return toView(existing);
  const token = createShareToken();
  const created = await prisma.docsShare.create({
    data: {
      userId,
      scope,
      documentId,
      spaceId,
      token,
      tokenHash: hashShareToken(token),
      documentIds: JSON.stringify(documentIds),
      expiresAt: expiryFromDays(input.expiresInDays),
      watermarkText: clampWatermark(input.watermarkText),
      watermarkOpacity: clampOpacity(input.watermarkOpacity),
      watermarkOnPrint: Boolean(input.watermarkOnPrint),
    },
  });
  return toView(created);
}

export async function updateDocsShare(
  userId: string,
  shareId: string,
  input: {
    action?: "revoke" | "regenerate" | "update";
    documentIds?: unknown;
    expiresInDays?: unknown;
    watermarkText?: unknown;
    watermarkOpacity?: unknown;
    watermarkOnPrint?: unknown;
  },
) {
  const row = await prisma.docsShare.findFirst({ where: { id: shareId, userId } });
  if (!row) throw new DocsWikiError("找不到这个分享", 404);
  if (input.action === "revoke") {
    const updated = await prisma.docsShare.update({
      where: { id: row.id },
      data: { revokedAt: new Date(), version: { increment: 1 } },
    });
    return toView(updated);
  }
  if (input.action === "regenerate") {
    const token = createShareToken();
    const updated = await prisma.docsShare.update({
      where: { id: row.id },
      data: {
        token,
        tokenHash: hashShareToken(token),
        revokedAt: null,
        version: { increment: 1 },
      },
    });
    return toView(updated);
  }
  const data: {
    documentIds?: string;
    expiresAt?: Date | null;
    watermarkText?: string;
    watermarkOpacity?: number;
    watermarkOnPrint?: boolean;
    version: { increment: number };
  } = { version: { increment: 1 } };
  if (row.scope === "space" && input.documentIds !== undefined) {
    const placed = new Set(await documentsInSpace(userId, row.spaceId || ""));
    const ids = (await ownedDocumentIds(userId, parseShareDocumentIds(input.documentIds))).filter((id) =>
      placed.has(id),
    );
    data.documentIds = JSON.stringify(ids);
  }
  if (input.expiresInDays !== undefined) data.expiresAt = expiryFromDays(input.expiresInDays);
  if (input.watermarkText !== undefined) data.watermarkText = clampWatermark(input.watermarkText);
  if (input.watermarkOpacity !== undefined) data.watermarkOpacity = clampOpacity(input.watermarkOpacity);
  if (input.watermarkOnPrint !== undefined) data.watermarkOnPrint = Boolean(input.watermarkOnPrint);
  const updated = await prisma.docsShare.update({ where: { id: row.id }, data });
  return toView(updated);
}

async function shareByToken(token: string): Promise<ShareRow | null> {
  if (!isShareToken(token)) return null;
  return prisma.docsShare.findUnique({ where: { tokenHash: hashShareToken(token) } });
}

async function visibleIds(row: ShareRow): Promise<string[]> {
  const grant = grantOf(row);
  if (!shareIsActive(grant)) return [];
  if (grant.scope === "document") {
    if (!row.documentId) return [];
    const doc = await prisma.docsDocument.findFirst({
      where: { id: row.documentId, userId: row.userId },
      select: { id: true },
    });
    return doc ? [doc.id] : [];
  }
  if (!row.spaceId) return [];
  const placed = await documentsInSpace(row.userId, row.spaceId);
  return visibleSharedDocumentIds(grant, placed);
}

export async function readPublicDocs(token: string, requestedId?: string | null): Promise<DocsPublicPayload> {
  const row = await shareByToken(token);
  if (!row) throw new DocsShareClosedError();
  const visible = await visibleIds(row);
  if (!visible.length && grantOf(row).scope === "document") throw new DocsShareClosedError();
  if (!shareIsActive(grantOf(row))) throw new DocsShareClosedError();
  const selected = requestedId ? (visible.includes(requestedId) ? requestedId : "") : visible[0] || "";
  if (requestedId && !selected) throw new DocsShareClosedError();
  const summaries = visible.length
    ? await prisma.docsDocument.findMany({
        where: { userId: row.userId, id: { in: visible } },
        select: { id: true, title: true, updatedAt: true },
      })
    : [];
  const order = new Map(visible.map((id, index) => [id, index]));
  const documents = summaries
    .map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt.toISOString(),
    }))
    .sort((a, b) => (order.get(a.id) || 0) - (order.get(b.id) || 0));
  const tagRows = visible.length
    ? await prisma.docsDocumentTag.findMany({
        where: { documentId: { in: visible } },
        select: { tag: { select: { name: true } } },
      })
    : [];
  const counts = new Map<string, number>();
  for (const tag of tagRows) counts.set(tag.tag.name, (counts.get(tag.tag.name) || 0) + 1);
  let document: DocsDocumentPayload | null = null;
  let media: Record<string, string> = {};
  if (selected) {
    const full = await prisma.docsDocument.findFirst({
      where: { id: selected, userId: row.userId },
    });
    if (!full) throw new DocsShareClosedError();
    document = parseStoredDocument(full);
    media = await signDocumentMedia(document.content);
  }
  const space = row.spaceId
    ? await prisma.docsSpace.findFirst({
        where: { id: row.spaceId, userId: row.userId },
        select: { name: true },
      })
    : null;
  const currentTitle = document?.title || "文档";
  const breadcrumb =
    row.scope === "space"
      ? [{ label: space?.name || "分享的知识库" }, { label: currentTitle }]
      : [{ label: "分享的文档" }, { label: currentTitle }];
  return {
    scope: row.scope === "space" ? "space" : "document",
    version: row.version,
    notice: SHARE_NOTICE,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    spaceName: row.scope === "space" ? space?.name || "分享的知识库" : null,
    watermark: {
      text: row.watermarkText,
      opacity: row.watermarkText ? row.watermarkOpacity : 0,
      onPrint: row.watermarkOnPrint,
    },
    mediaExpiresInSec: DOCS_MEDIA_SIGN_TTL_SEC,
    documents,
    tags: [...counts.entries()].map(([name, count]) => ({ name, count })),
    breadcrumb,
    document,
    media,
  };
}

async function signDocumentMedia(content: DocsJsonNode): Promise<Record<string, string>> {
  const srcs = new Set<string>();
  const walk = (node: DocsJsonNode) => {
    if (node.type === "image") {
      const src = String(node.attrs?.src || "");
      if (/^https?:\/\//i.test(src)) srcs.add(src);
    }
    node.content?.forEach(walk);
  };
  walk(content);
  if (!srcs.size) return {};
  const { resolveStoredAccessUrl } = await import("@andyyyds/shared/storage");
  const media: Record<string, string> = {};
  for (const src of srcs) {
    try {
      const signed = await resolveStoredAccessUrl(src, DOCS_MEDIA_SIGN_TTL_SEC);
      if (signed) media[src] = signed;
    } catch {
      media[src] = src;
    }
  }
  return media;
}

export async function searchPublicDocs(token: string, rawQuery: unknown): Promise<
  { documentId: string; title: string; snippet: DocsSearchSnippet | null }[]
> {
  const row = await shareByToken(token);
  if (!row || !shareIsActive(grantOf(row))) throw new DocsShareClosedError();
  const visible = await visibleIds(row);
  const query = normalizeSearchQuery(rawQuery);
  if (!query || !visible.length) return [];
  const rows = await prisma.docsDocument.findMany({
    where: {
      userId: row.userId,
      id: { in: visible },
      OR: [{ title: { contains: query } }, { plainText: { contains: query } }],
    },
    take: 20,
    select: { id: true, title: true, plainText: true },
  });
  return rows.map((item) => ({
    documentId: item.id,
    title: item.title,
    snippet: buildSearchSnippet(item.plainText || item.title, query),
  }));
}

export async function resolveDocsMediaUrl(input: {
  src: string;
  userId?: string | null;
  token?: string | null;
}): Promise<string> {
  const src = String(input.src || "").trim();
  if (!src || src.startsWith("blob:") || src.startsWith("data:") || src.startsWith("file:")) {
    throw new DocsShareClosedError();
  }
  if (input.token) {
    const row = await shareByToken(input.token);
    if (!row || !shareIsActive(grantOf(row))) throw new DocsShareClosedError();
    const visible = await visibleIds(row);
    const hit = await prisma.docsDocument.findFirst({
      where: { userId: row.userId, id: { in: visible }, content: { contains: src } },
    });
    if (!hit || !shareAllowsDocument(grantOf(row), hit.id, visible)) throw new DocsShareClosedError();
    const parsed = parseStoredDocument(hit);
    if (!documentContainsMediaSrc(parsed.content, src)) throw new DocsShareClosedError();
    return signOne(src);
  }
  if (!input.userId) throw new DocsShareClosedError();
  const { userOwnsUploadUrl } = await import("@andyyyds/docs/lib/docs-access");
  if (userOwnsUploadUrl(input.userId, src)) return signOne(src);
  const hit = await prisma.docsDocument.findFirst({
    where: { userId: input.userId, content: { contains: src } },
  });
  if (!hit) throw new DocsShareClosedError();
  const parsed = parseStoredDocument(hit);
  if (!documentContainsMediaSrc(parsed.content, src)) throw new DocsShareClosedError();
  return signOne(src);
}

async function signOne(src: string): Promise<string> {
  if (src.startsWith("/")) return src;
  const { resolveStoredAccessUrl } = await import("@andyyyds/shared/storage");
  try {
    return (await resolveStoredAccessUrl(src, DOCS_MEDIA_SIGN_TTL_SEC)) || src;
  } catch {
    return src;
  }
}

export function publicShareAllows(share: DocsShareGrant, documentId: string, existing: readonly string[]): boolean {
  return shareAllowsDocument(share, documentId, existing);
}
