import { prisma } from "@andyyyds/shared/db";
import {
  clampDocsTitle,
  DOCS_MAX_PER_USER,
  emptyDocsContent,
  extractPlainText,
  parseStoredDocument,
  sanitizeDocsContent,
  serializeDocsContent,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import { assignHeadingAnchors } from "@andyyyds/docs/lib/docs-outline";
import { clampPlainText } from "@andyyyds/docs/lib/docs-search";
import {
  DEFAULT_DOCS_PAGE_CHROME,
  normalizePageChrome,
  type DocsPageChrome,
} from "@andyyyds/docs/lib/docs-page";
import {
  DEFAULT_DOCS_LIST_SCHEME,
  normalizeListScheme,
  type DocsListScheme,
} from "@andyyyds/docs/lib/docs-scheme";

export class DocsLimitError extends Error {
  constructor() {
    super(`最多保存 ${DOCS_MAX_PER_USER} 篇文档，请先删除不用的`);
    this.name = "DocsLimitError";
  }
}

export class DocsNotFoundError extends Error {
  constructor() {
    super("文档不存在或已删除");
    this.name = "DocsNotFoundError";
  }
}

export class DocsConflictError extends Error {
  current: DocsDocumentPayload;
  constructor(current: DocsDocumentPayload) {
    super("这篇文档在其他页面已更新。当前编辑还在，没有被覆盖。");
    this.name = "DocsConflictError";
    this.current = current;
  }
}

function contentForStore(content: DocsJsonNode, docId: string): { json: string; plainText: string } {
  const anchored = assignHeadingAnchors(sanitizeDocsContent(content), docId).content;
  return {
    json: serializeDocsContent(anchored),
    plainText: clampPlainText(extractPlainText(anchored)),
  };
}

export type DocsDocumentSummary = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  preview: string;
};

export async function listDocsSummaries(userId: string): Promise<DocsDocumentSummary[]> {
  const rows = await prisma.docsDocument.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: DOCS_MAX_PER_USER,
    select: { id: true, title: true, updatedAt: true, createdAt: true, plainText: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: clampDocsTitle(row.title),
    updatedAt: row.updatedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    preview: row.plainText.replace(/\s+/g, " ").trim().slice(0, 80),
  }));
}

export async function listDocsDocuments(userId: string): Promise<DocsDocumentPayload[]> {
  const rows = await prisma.docsDocument.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: DOCS_MAX_PER_USER,
  });
  return rows.map(parseStoredDocument);
}

export async function getDocsDocument(
  userId: string,
  id: string,
): Promise<DocsDocumentPayload> {
  const row = await prisma.docsDocument.findFirst({
    where: { id, userId },
  });
  if (!row) throw new DocsNotFoundError();
  return parseStoredDocument(row);
}

export async function createDocsDocument(
  userId: string,
  input?: {
    title?: string;
    content?: DocsJsonNode;
    listScheme?: DocsListScheme;
    pageChrome?: DocsPageChrome;
  },
): Promise<DocsDocumentPayload> {
  const count = await prisma.docsDocument.count({ where: { userId } });
  if (count >= DOCS_MAX_PER_USER) throw new DocsLimitError();

  const content = input?.content ? input.content : emptyDocsContent();
  const row = await prisma.docsDocument.create({
    data: {
      userId,
      title: clampDocsTitle(input?.title),
      content: serializeDocsContent(sanitizeDocsContent(content)),
      plainText: clampPlainText(extractPlainText(sanitizeDocsContent(content))),
      listScheme: JSON.stringify(
        normalizeListScheme(input?.listScheme || DEFAULT_DOCS_LIST_SCHEME),
      ),
      pageChrome: JSON.stringify(
        normalizePageChrome(input?.pageChrome || DEFAULT_DOCS_PAGE_CHROME),
      ),
    },
  });
  const stored = contentForStore(content, row.id);
  if (stored.json === row.content && stored.plainText === row.plainText) {
    return parseStoredDocument(row);
  }
  const updated = await prisma.docsDocument.update({
    where: { id: row.id },
    data: { content: stored.json, plainText: stored.plainText },
  });
  return parseStoredDocument(updated);
}

export async function updateDocsDocument(
  userId: string,
  id: string,
  input: {
    title?: string;
    content?: DocsJsonNode;
    listScheme?: DocsListScheme;
    pageChrome?: DocsPageChrome;
    baseUpdatedAt?: string | null;
    force?: boolean;
  },
): Promise<DocsDocumentPayload> {
  const existing = await prisma.docsDocument.findFirst({
    where: { id, userId },
  });
  if (!existing) throw new DocsNotFoundError();
  if (
    !input.force &&
    input.baseUpdatedAt &&
    new Date(existing.updatedAt).getTime() !== new Date(input.baseUpdatedAt).getTime()
  ) {
    throw new DocsConflictError(parseStoredDocument(existing));
  }

  const data: {
    title?: string;
    content?: string;
    plainText?: string;
    listScheme?: string;
    pageChrome?: string;
  } = {};
  if (input.title !== undefined) data.title = clampDocsTitle(input.title);
  if (input.content !== undefined) {
    const stored = contentForStore(input.content, id);
    data.content = stored.json;
    data.plainText = stored.plainText;
  }
  if (input.listScheme !== undefined) {
    data.listScheme = JSON.stringify(normalizeListScheme(input.listScheme));
  }
  if (input.pageChrome !== undefined) {
    data.pageChrome = JSON.stringify(normalizePageChrome(input.pageChrome));
  }

  const row = await prisma.docsDocument.update({
    where: { id },
    data,
  });
  if (data.title) {
    await prisma.docsNode.updateMany({
      where: { userId, documentId: id, kind: "document" },
      data: { name: data.title },
    });
  }
  return parseStoredDocument(row);
}

export async function deleteDocsDocument(userId: string, id: string): Promise<void> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.docsNode.deleteMany({ where: { userId, documentId: id } });
    return tx.docsDocument.deleteMany({ where: { id, userId } });
  });
  if (result.count === 0) throw new DocsNotFoundError();
}
