/**
 * 知识库树的纯规则：防环、排序、删除文件夹时子内容上移。
 * 不访问数据库。
 */

export const DOCS_SPACE_NAME_MAX = 40;
export const DOCS_NODE_NAME_MAX = 80;

export type DocsTreeKind = "folder" | "document";
export type DocsTreeStatus = "active" | "trashed";

export type DocsTreeRecord = {
  id: string;
  parentId: string | null;
  kind: DocsTreeKind;
  status: DocsTreeStatus;
};

export function clampSpaceName(raw: unknown): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, DOCS_SPACE_NAME_MAX);
  return name || "未命名知识库";
}

export function clampNodeName(raw: unknown, fallback = "未命名"): string {
  const name = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, DOCS_NODE_NAME_MAX);
  return name || fallback;
}

export function createsTreeCycle(
  nodes: readonly { id: string; parentId: string | null }[],
  nodeId: string,
  nextParentId: string | null,
): boolean {
  if (!nextParentId) return false;
  if (nextParentId === nodeId) return true;
  const parentOf = new Map(nodes.map((node) => [node.id, node.parentId]));
  const seen = new Set<string>();
  let cursor: string | null = nextParentId;
  while (cursor) {
    if (cursor === nodeId || seen.has(cursor)) return true;
    seen.add(cursor);
    cursor = parentOf.get(cursor) || null;
  }
  return false;
}

export function siblingSortOrders(idsInOrder: readonly string[]): { id: string; sortOrder: number }[] {
  const seen = new Set<string>();
  const unique = idsInOrder.filter((id) => {
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return unique.map((id, index) => ({ id, sortOrder: index }));
}

export function folderTrashPlan(
  nodes: readonly DocsTreeRecord[],
  folderId: string,
): { trashId: string; reparent: { id: string; parentId: string | null }[] } | null {
  const folder = nodes.find((node) => node.id === folderId && node.kind === "folder");
  if (!folder || folder.status !== "active") return null;
  const reparent = nodes
    .filter((node) => node.parentId === folderId && node.status === "active")
    .map((node) => ({ id: node.id, parentId: folder.parentId }));
  return { trashId: folderId, reparent };
}

export type DocsBreadcrumb = {
  label: string;
  href: string | null;
};

export function breadcrumbForDocument(input: {
  spaces: readonly { id: string; name: string }[];
  nodes: readonly {
    id: string;
    spaceId: string;
    parentId: string | null;
    kind: DocsTreeKind;
    name: string;
    documentId: string | null;
    status: DocsTreeStatus;
  }[];
  documentId: string;
  documentTitle: string;
}): DocsBreadcrumb[] {
  const crumbs: DocsBreadcrumb[] = [{ label: "颗秒文档", href: "/products/docs" }];
  const node = input.nodes.find(
    (item) => item.kind === "document" && item.documentId === input.documentId && item.status === "active",
  );
  if (!node) {
    crumbs.push({ label: "未分类", href: "/products/docs" });
    crumbs.push({ label: input.documentTitle, href: null });
    return crumbs;
  }
  const space = input.spaces.find((item) => item.id === node.spaceId);
  crumbs.push({ label: space?.name || "知识库", href: `/products/docs?space=${encodeURIComponent(node.spaceId)}` });
  const chain: { id: string; name: string }[] = [];
  const byId = new Map(input.nodes.map((item) => [item.id, item]));
  const seen = new Set<string>();
  let parentId = node.parentId;
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent || parent.status !== "active" || parent.kind !== "folder") break;
    chain.push({ id: parent.id, name: parent.name });
    parentId = parent.parentId;
  }
  chain.reverse().forEach((folder) => {
    crumbs.push({
      label: folder.name,
      href: `/products/docs?space=${encodeURIComponent(node.spaceId)}&folder=${encodeURIComponent(folder.id)}`,
    });
  });
  crumbs.push({ label: input.documentTitle, href: null });
  return crumbs;
}
