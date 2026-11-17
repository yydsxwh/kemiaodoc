/** 知识库、标签、分享在浏览器和接口之间共用的形状。不含数据库客户端。 */

export type DocsLibraryDocument = {
  id: string;
  title: string;
  updatedAt: string;
  createdAt: string;
  preview: string;
};

export type DocsLibraryNode = {
  id: string;
  spaceId: string;
  parentId: string | null;
  kind: "folder" | "document";
  name: string;
  documentId: string | null;
  sortOrder: number;
  status: "active" | "trashed";
};

export type DocsLibrarySpace = {
  id: string;
  name: string;
  updatedAt: string;
};

export type DocsLibraryTag = {
  id: string;
  key: string;
  name: string;
  documentIds: string[];
};

export type DocsLibrarySnapshot = {
  spaces: DocsLibrarySpace[];
  nodes: DocsLibraryNode[];
  documents: DocsLibraryDocument[];
  tags: DocsLibraryTag[];
};

export type DocsShareView = {
  id: string;
  scope: "document" | "space";
  documentId: string | null;
  spaceId: string | null;
  spaceName: string;
  documentIds: string[];
  token: string;
  path: string;
  expiresAt: string | null;
  revokedAt: string | null;
  version: number;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkOnPrint: boolean;
  active: boolean;
};

export type DocsWikiAction =
  | { action: "createSpace"; name?: string }
  | { action: "renameSpace"; spaceId: string; name: string }
  | { action: "deleteSpace"; spaceId: string }
  | { action: "createFolder"; spaceId: string; parentId?: string | null; name?: string }
  | { action: "renameNode"; nodeId: string; name: string }
  | { action: "moveNode"; nodeId: string; parentId?: string | null; index?: number }
  | { action: "trashFolder"; nodeId: string }
  | { action: "restoreFolder"; nodeId: string }
  | {
      action: "placeDocument";
      documentId: string;
      spaceId: string;
      parentId?: string | null;
      index?: number;
    }
  | { action: "unplaceDocument"; documentId: string };

export function sharePath(token: string, documentId?: string | null, anchorId?: string | null): string {
  const query = documentId ? `?doc=${encodeURIComponent(documentId)}` : "";
  const hash = anchorId ? `#${encodeURIComponent(anchorId)}` : "";
  return `/products/docs/share/${encodeURIComponent(token)}${query}${hash}`;
}
