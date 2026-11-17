/**
 * 知识库、文件夹、标签和作者搜索。
 * 每个节点只有一个正式父级。删文件夹只把文件夹放进回收站，子内容回到上一级。
 */

import { prisma } from "@andyyyds/shared/db";
import type { DocsLibrarySnapshot, DocsWikiAction } from "@andyyyds/docs/lib/docs-library";
import { listDocsSummaries } from "@andyyyds/docs/lib/docs-store";
import { buildSearchSnippet, clampPlainText, normalizeSearchQuery, type DocsSearchSnippet } from "@andyyyds/docs/lib/docs-search";
import {
  DOCS_TAGS_PER_DOCUMENT,
  normalizeTagName,
  tagKeyFromName,
} from "@andyyyds/docs/lib/docs-tags";
import {
  clampNodeName,
  clampSpaceName,
  createsTreeCycle,
  folderTrashPlan,
  siblingSortOrders,
  type DocsTreeRecord,
} from "@andyyyds/docs/lib/docs-tree";

export class DocsWikiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "DocsWikiError";
    this.status = status;
  }
}

export type DocsSearchHit = {
  documentId: string;
  title: string;
  updatedAt: string;
  snippet: DocsSearchSnippet | null;
  tags: string[];
};

type NodeRow = {
  id: string;
  spaceId: string;
  parentId: string | null;
  kind: string;
  name: string;
  documentId: string | null;
  sortOrder: number;
  status: string;
};

function asKind(value: string): "folder" | "document" {
  return value === "document" ? "document" : "folder";
}

function asStatus(value: string): "active" | "trashed" {
  return value === "trashed" ? "trashed" : "active";
}

function toTree(nodes: NodeRow[]): DocsTreeRecord[] {
  return nodes.map((node) => ({
    id: node.id,
    parentId: node.parentId,
    kind: asKind(node.kind),
    status: asStatus(node.status),
  }));
}

async function loadNodes(userId: string): Promise<NodeRow[]> {
  return prisma.docsNode.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function getDocsLibrary(userId: string): Promise<DocsLibrarySnapshot> {
  const [spaces, nodes, documents, tags] = await Promise.all([
    prisma.docsSpace.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, updatedAt: true },
    }),
    loadNodes(userId),
    listDocsSummaries(userId),
    prisma.docsTag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: { documents: { select: { documentId: true } } },
    }),
  ]);
  return {
    spaces: spaces.map((space) => ({
      id: space.id,
      name: space.name,
      updatedAt: space.updatedAt.toISOString(),
    })),
    nodes: nodes.map((node) => ({
      id: node.id,
      spaceId: node.spaceId,
      parentId: node.parentId,
      kind: asKind(node.kind),
      name: node.name,
      documentId: node.documentId,
      sortOrder: node.sortOrder,
      status: asStatus(node.status),
    })),
    documents,
    tags: tags.map((tag) => ({
      id: tag.id,
      key: tag.key,
      name: tag.name,
      documentIds: tag.documents.map((item) => item.documentId),
    })),
  };
}

async function ownedSpace(userId: string, spaceId: string) {
  const space = await prisma.docsSpace.findFirst({ where: { id: spaceId, userId } });
  if (!space) throw new DocsWikiError("找不到这个知识库", 404);
  return space;
}

async function ownedNode(userId: string, nodeId: string) {
  const node = await prisma.docsNode.findFirst({ where: { id: nodeId, userId } });
  if (!node) throw new DocsWikiError("找不到这个目录", 404);
  return node;
}

function parentInSpace(nodes: NodeRow[], spaceId: string, parentId: string | null) {
  if (!parentId) return;
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent || parent.spaceId !== spaceId || parent.kind !== "folder" || parent.status !== "active") {
    throw new DocsWikiError("只能放到这个知识库里的文件夹", 400);
  }
}

async function reindex(userId: string, spaceId: string, parentId: string | null, orderedIds: string[]) {
  const orders = siblingSortOrders(orderedIds);
  await prisma.$transaction(
    orders.map((item) =>
      prisma.docsNode.updateMany({
        where: { id: item.id, userId, spaceId },
        data: { sortOrder: item.sortOrder, parentId },
      }),
    ),
  );
}

function siblingIds(nodes: NodeRow[], spaceId: string, parentId: string | null, extraId?: string): string[] {
  const ids = nodes
    .filter(
      (node) =>
        node.spaceId === spaceId &&
        node.parentId === parentId &&
        node.status === "active" &&
        node.id !== extraId,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .map((node) => node.id);
  return ids;
}

function placeIndex(ids: string[], id: string, index?: number): string[] {
  const next = ids.filter((item) => item !== id);
  const at = index === undefined ? next.length : Math.min(next.length, Math.max(0, index));
  next.splice(at, 0, id);
  return next;
}

export async function applyDocsWikiAction(
  userId: string,
  action: DocsWikiAction,
): Promise<DocsLibrarySnapshot> {
  if (action.action === "createSpace") {
    const count = await prisma.docsSpace.count({ where: { userId } });
    if (count >= 40) throw new DocsWikiError("知识库最多 40 个");
    await prisma.docsSpace.create({
      data: { userId, name: clampSpaceName(action.name) },
    });
  } else if (action.action === "renameSpace") {
    await ownedSpace(userId, action.spaceId);
    await prisma.docsSpace.update({
      where: { id: action.spaceId },
      data: { name: clampSpaceName(action.name) },
    });
  } else if (action.action === "deleteSpace") {
    await ownedSpace(userId, action.spaceId);
    await prisma.docsSpace.delete({ where: { id: action.spaceId } });
  } else if (action.action === "createFolder") {
    await ownedSpace(userId, action.spaceId);
    const nodes = await loadNodes(userId);
    const parentId = action.parentId || null;
    parentInSpace(nodes, action.spaceId, parentId);
    if (createsTreeCycle(nodes, "new-folder", parentId)) {
      throw new DocsWikiError("不能把文件夹放进自己的子目录");
    }
    const created = await prisma.docsNode.create({
      data: {
        userId,
        spaceId: action.spaceId,
        parentId,
        kind: "folder",
        name: clampNodeName(action.name, "未命名文件夹"),
        sortOrder: 0,
        status: "active",
      },
    });
    const ordered = placeIndex(siblingIds(nodes, action.spaceId, parentId), created.id);
    await reindex(userId, action.spaceId, parentId, ordered);
  } else if (action.action === "renameNode") {
    const node = await ownedNode(userId, action.nodeId);
    const name = clampNodeName(action.name, node.kind === "folder" ? "未命名文件夹" : "未命名文档");
    await prisma.docsNode.update({ where: { id: node.id }, data: { name } });
    if (node.kind === "document" && node.documentId) {
      await prisma.docsDocument.updateMany({
        where: { id: node.documentId, userId },
        data: { title: name },
      });
    }
  } else if (action.action === "moveNode") {
    const node = await ownedNode(userId, action.nodeId);
    if (node.status !== "active") throw new DocsWikiError("回收站里的文件夹要先恢复");
    const nodes = await loadNodes(userId);
    const parentId = action.parentId || null;
    parentInSpace(nodes, node.spaceId, parentId);
    if (node.kind === "folder" && createsTreeCycle(nodes, node.id, parentId)) {
      throw new DocsWikiError("不能把文件夹放进自己的子目录");
    }
    const previousParent = node.parentId;
    const ordered = placeIndex(siblingIds(nodes, node.spaceId, parentId, node.id), node.id, action.index);
    await reindex(userId, node.spaceId, parentId, ordered);
    if (previousParent !== parentId) {
      const refreshed = await loadNodes(userId);
      await reindex(userId, node.spaceId, previousParent, siblingIds(refreshed, node.spaceId, previousParent));
    }
  } else if (action.action === "trashFolder") {
    const nodes = await loadNodes(userId);
    const node = nodes.find((item) => item.id === action.nodeId && item.kind === "folder");
    if (!node) throw new DocsWikiError("找不到这个文件夹", 404);
    const plan = folderTrashPlan(toTree(nodes), node.id);
    if (!plan) throw new DocsWikiError("这个文件夹已经在回收站");
    await prisma.$transaction(async (tx) => {
      for (const child of plan.reparent) {
        await tx.docsNode.updateMany({
          where: { id: child.id, userId },
          data: { parentId: child.parentId },
        });
      }
      await tx.docsNode.updateMany({
        where: { id: plan.trashId, userId },
        data: { status: "trashed", parentId: node.parentId },
      });
    });
  } else if (action.action === "restoreFolder") {
    const node = await ownedNode(userId, action.nodeId);
    if (node.kind !== "folder") throw new DocsWikiError("只能恢复文件夹");
    const nodes = await loadNodes(userId);
    const parent = node.parentId ? nodes.find((item) => item.id === node.parentId) : null;
    const parentId = parent && parent.status === "active" && parent.kind === "folder" ? parent.id : null;
    await prisma.docsNode.updateMany({
      where: { id: node.id, userId },
      data: { status: "active", parentId },
    });
  } else if (action.action === "placeDocument") {
    const doc = await prisma.docsDocument.findFirst({
      where: { id: action.documentId, userId },
      select: { id: true, title: true },
    });
    if (!doc) throw new DocsWikiError("找不到这篇文档", 404);
    await ownedSpace(userId, action.spaceId);
    const nodes = await loadNodes(userId);
    const parentId = action.parentId || null;
    parentInSpace(nodes, action.spaceId, parentId);
    await prisma.docsNode.deleteMany({
      where: { userId, documentId: doc.id, kind: "document" },
    });
    const created = await prisma.docsNode.create({
      data: {
        userId,
        spaceId: action.spaceId,
        parentId,
        kind: "document",
        name: clampNodeName(doc.title, "未命名文档"),
        documentId: doc.id,
        sortOrder: 0,
        status: "active",
      },
    });
    const remaining = (await loadNodes(userId)).filter((item) => item.id !== created.id);
    const ordered = placeIndex(
      siblingIds(remaining, action.spaceId, parentId),
      created.id,
      action.index,
    );
    await reindex(userId, action.spaceId, parentId, ordered);
  } else if (action.action === "unplaceDocument") {
    await prisma.docsNode.deleteMany({
      where: { userId, documentId: action.documentId, kind: "document" },
    });
  } else {
    throw new DocsWikiError("不认识这个操作");
  }
  return getDocsLibrary(userId);
}

export async function addDocumentTag(userId: string, documentId: string, rawName: unknown) {
  const name = normalizeTagName(rawName);
  if (!name) throw new DocsWikiError("请填写标签");
  const doc = await prisma.docsDocument.findFirst({
    where: { id: documentId, userId },
    select: { id: true },
  });
  if (!doc) throw new DocsWikiError("找不到这篇文档", 404);
  const key = tagKeyFromName(name);
  const tag = await prisma.docsTag.upsert({
    where: { userId_key: { userId, key } },
    update: {},
    create: { userId, key, name },
  });
  const count = await prisma.docsDocumentTag.count({ where: { documentId } });
  const existing = await prisma.docsDocumentTag.findUnique({
    where: { documentId_tagId: { documentId, tagId: tag.id } },
  });
  if (!existing && count >= DOCS_TAGS_PER_DOCUMENT) {
    throw new DocsWikiError(`一篇文档最多 ${DOCS_TAGS_PER_DOCUMENT} 个标签`);
  }
  await prisma.docsDocumentTag.upsert({
    where: { documentId_tagId: { documentId, tagId: tag.id } },
    update: {},
    create: { documentId, tagId: tag.id },
  });
  return getDocsLibrary(userId);
}

export async function removeDocumentTag(userId: string, documentId: string, tagId: string) {
  const tag = await prisma.docsTag.findFirst({ where: { id: tagId, userId }, select: { id: true } });
  if (!tag) throw new DocsWikiError("找不到这个标签", 404);
  await prisma.docsDocumentTag.deleteMany({ where: { documentId, tagId } });
  const left = await prisma.docsDocumentTag.count({ where: { tagId } });
  if (left === 0) await prisma.docsTag.deleteMany({ where: { id: tagId, userId } });
  return getDocsLibrary(userId);
}

export async function renameDocsTag(userId: string, tagId: string, rawName: unknown) {
  const name = normalizeTagName(rawName);
  if (!name) throw new DocsWikiError("请填写标签");
  const tag = await prisma.docsTag.findFirst({ where: { id: tagId, userId } });
  if (!tag) throw new DocsWikiError("找不到这个标签", 404);
  await prisma.docsTag.update({ where: { id: tag.id }, data: { name } });
  return getDocsLibrary(userId);
}

export async function searchOwnedDocs(
  userId: string,
  rawQuery: unknown,
  tagKey?: string,
): Promise<DocsSearchHit[]> {
  const query = normalizeSearchQuery(rawQuery);
  const key = String(tagKey || "").trim();
  if (!query && !key) return [];
  const rows = await prisma.docsDocument.findMany({
    where: {
      userId,
      ...(key ? { documentTags: { some: { tag: { userId, key } } } } : {}),
      ...(query
        ? {
            OR: [
              { title: { contains: query } },
              { plainText: { contains: query } },
              { documentTags: { some: { tag: { userId, name: { contains: query } } } } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      plainText: true,
      updatedAt: true,
      documentTags: { select: { tag: { select: { name: true } } } },
    },
  });
  return rows.map((row) => {
    const tags = row.documentTags.map((item) => item.tag.name);
    const source = clampPlainText(row.plainText) || row.title;
    const snippet = query ? buildSearchSnippet(source, query) || buildSearchSnippet(row.title, query) : null;
    return {
      documentId: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      snippet,
      tags,
    };
  });
}
