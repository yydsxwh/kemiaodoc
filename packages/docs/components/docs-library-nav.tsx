"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { applyDocsWiki, searchDocs, type DocsSearchHit } from "@andyyyds/docs/lib/docs-client";
import type { DocsLibrarySnapshot } from "@andyyyds/docs/lib/docs-library";
import { breadcrumbForDocument } from "@andyyyds/docs/lib/docs-tree";

type Props = {
  library: DocsLibrarySnapshot | null;
  loggedIn: boolean;
  currentId: string;
  activeTag: string;
  onLibrary: (library: DocsLibrarySnapshot) => void;
  onTag: (key: string) => void;
  onError: (message: string) => void;
};

function sortedChildren(library: DocsLibrarySnapshot, spaceId: string, parentId: string | null) {
  return library.nodes
    .filter((node) => node.spaceId === spaceId && node.parentId === parentId && node.status === "active")
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "zh-CN"));
}

export function DocsLibraryNav({
  library,
  loggedIn,
  currentId,
  activeTag,
  onLibrary,
  onTag,
  onError,
}: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DocsSearchHit[] | null>(null);
  const [busy, setBusy] = useState("");
  const [moveId, setMoveId] = useState("");

  const uncategorized = useMemo(() => {
    if (!library) return [];
    const placed = new Set(
      library.nodes
        .filter((node) => node.kind === "document" && node.status === "active" && node.documentId)
        .map((node) => node.documentId),
    );
    return library.documents.filter((doc) => !placed.has(doc.id));
  }, [library]);

  const run = async (label: string, work: () => Promise<DocsLibrarySnapshot>) => {
    setBusy(label);
    try {
      onLibrary(await work());
    } catch (error) {
      onError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy("");
    }
  };

  const search = async () => {
    if (!query.trim() && !activeTag) {
      setHits(null);
      return;
    }
    try {
      setHits(await searchDocs(query, activeTag));
    } catch (error) {
      onError(error instanceof Error ? error.message : "搜索失败");
    }
  };

  if (!loggedIn || !library) {
    return (
      <p className="px-3 py-3 text-sm leading-6 text-[var(--muted)]">
        登录后可以把文档放进知识库，并生成访客能打开的分享链接。浏览器草稿不能当作分享网页。
      </p>
    );
  }

  const filteredDocs = activeTag
    ? new Set(library.tags.find((tag) => tag.key === activeTag)?.documentIds || [])
    : null;

  return (
    <div className="grid gap-3 px-3 py-3">
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label className="text-xs text-[var(--muted)]" htmlFor="docs-search">
          在我的文档中搜索标题、正文和标签
        </label>
        <div className="flex gap-2">
          <input
            id="docs-search"
            className="field min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索"
          />
          <button type="submit" className="btn btn-secondary min-h-11 px-3 text-sm">
            搜索
          </button>
        </div>
      </form>
      {hits ? (
        <div>
          <p className="text-xs text-[var(--muted)]">搜索结果 {hits.length} 条，只包含你能访问的文档。</p>
          <ul className="mt-2 grid gap-1">
            {hits.map((hit) => (
              <li key={hit.documentId}>
                <Link className="docs-tree-link" href={`/products/docs/${hit.documentId}`}>
                  <strong>{hit.title}</strong>
                  {hit.snippet ? <span>{hit.snippet.text}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn min-h-11 px-3 text-sm ${activeTag ? "btn-secondary" : "btn-primary"}`}
          onClick={() => onTag("")}
        >
          全部标签
        </button>
        {library.tags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            className={`btn min-h-11 px-3 text-sm ${activeTag === tag.key ? "btn-primary" : "btn-secondary"}`}
            onClick={() => onTag(activeTag === tag.key ? "" : tag.key)}
          >
            {tag.name}
            <span className="ml-1 text-xs">{tag.documentIds.length}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-secondary min-h-11 px-3 text-sm"
        disabled={Boolean(busy)}
        onClick={() => void run("space", () => applyDocsWiki({ action: "createSpace", name: "我的知识库" }))}
      >
        {busy === "space" ? "创建中…" : "新建知识库"}
      </button>
      {library.spaces.map((space) => (
        <section key={space.id} className="grid gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{space.name}</h3>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-2 text-xs"
              onClick={() => {
                const name = window.prompt("知识库名称", space.name);
                if (name) void run(space.id, () => applyDocsWiki({ action: "renameSpace", spaceId: space.id, name }));
              }}
            >
              改名
            </button>
            <button
              type="button"
              className="btn btn-secondary min-h-11 px-2 text-xs"
              onClick={() =>
                void run(space.id, () =>
                  applyDocsWiki({ action: "createFolder", spaceId: space.id, name: "新建文件夹" }),
                )
              }
            >
              文件夹
            </button>
          </div>
          <TreeLevel
            library={library}
            spaceId={space.id}
            parentId={null}
            currentId={currentId}
            filteredDocs={filteredDocs}
            moveId={moveId}
            onMove={setMoveId}
            onRun={run}
          />
        </section>
      ))}
      <section>
        <h3 className="text-sm font-semibold">未分类</h3>
        <ul className="mt-1 grid gap-1">
          {uncategorized
            .filter((doc) => !filteredDocs || filteredDocs.has(doc.id))
            .map((doc) => (
              <li key={doc.id} className="flex items-center gap-1">
                <Link className={`docs-tree-link min-w-0 flex-1 ${doc.id === currentId ? "is-current" : ""}`} href={`/products/docs/${doc.id}`}>
                  {doc.title}
                </Link>
                {library.spaces[0] ? (
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-2 text-xs"
                    onClick={() =>
                      void run(doc.id, () =>
                        applyDocsWiki({
                          action: "placeDocument",
                          documentId: doc.id,
                          spaceId: library.spaces[0].id,
                          parentId: null,
                        }),
                      )
                    }
                  >
                    放入
                  </button>
                ) : null}
              </li>
            ))}
        </ul>
        {!uncategorized.length ? <p className="mt-1 text-xs text-[var(--muted)]">没有未分类文档。</p> : null}
      </section>
      {library.nodes.some((node) => node.status === "trashed") ? (
        <section>
          <h3 className="text-sm font-semibold">文件夹回收站</h3>
          <ul className="mt-1 grid gap-1">
            {library.nodes
              .filter((node) => node.kind === "folder" && node.status === "trashed")
              .map((node) => (
                <li key={node.id}>
                  <button
                    type="button"
                    className="btn btn-secondary min-h-11 px-3 text-sm"
                    onClick={() => void run(node.id, () => applyDocsWiki({ action: "restoreFolder", nodeId: node.id }))}
                  >
                    恢复 {node.name}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function TreeLevel({
  library,
  spaceId,
  parentId,
  currentId,
  filteredDocs,
  moveId,
  onMove,
  onRun,
}: {
  library: DocsLibrarySnapshot;
  spaceId: string;
  parentId: string | null;
  currentId: string;
  filteredDocs: Set<string> | null;
  moveId: string;
  onMove: (id: string) => void;
  onRun: (label: string, work: () => Promise<DocsLibrarySnapshot>) => Promise<void>;
}) {
  const nodes = sortedChildren(library, spaceId, parentId).filter((node) => {
    if (!filteredDocs || node.kind === "folder") return true;
    return node.documentId ? filteredDocs.has(node.documentId) : false;
  });
  if (!nodes.length) return null;
  return (
    <ul className="grid gap-1">
      {nodes.map((node, index) => (
        <li key={node.id}>
          {node.kind === "folder" ? (
            <div className="docs-folder">
              <div className="flex flex-wrap items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-sm">{node.name}</span>
                <button type="button" className="btn btn-secondary min-h-11 px-2 text-xs" onClick={() => onMove(moveId === node.id ? "" : node.id)}>
                  移动到
                </button>
                <button
                  type="button"
                  className="btn btn-secondary min-h-11 px-2 text-xs"
                  onClick={() => {
                    if (window.confirm(`把文件夹“${node.name}”放进回收站？里面的文档会回到上一级，不会被删除。`)) {
                      void onRun(node.id, () => applyDocsWiki({ action: "trashFolder", nodeId: node.id }));
                    }
                  }}
                >
                  回收
                </button>
              </div>
              {moveId === node.id ? (
                <FolderDestinations library={library} spaceId={spaceId} nodeId={node.id} onRun={onRun} />
              ) : null}
              <TreeLevel
                library={library}
                spaceId={spaceId}
                parentId={node.id}
                currentId={currentId}
                filteredDocs={filteredDocs}
                moveId={moveId}
                onMove={onMove}
                onRun={onRun}
              />
            </div>
          ) : (
            <>
            <div className="flex flex-wrap items-center gap-1">
              <Link
                className={`docs-tree-link min-w-0 flex-1 ${node.documentId === currentId ? "is-current" : ""}`}
                href={`/products/docs/${node.documentId}`}
              >
                {node.name}
              </Link>
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-2 text-xs"
                aria-label="上移"
                onClick={() =>
                  void onRun(node.id, () =>
                    applyDocsWiki({ action: "moveNode", nodeId: node.id, parentId, index: Math.max(0, index - 1) }),
                  )
                }
              >
                上
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-2 text-xs"
                aria-label="下移"
                onClick={() =>
                  void onRun(node.id, () =>
                    applyDocsWiki({ action: "moveNode", nodeId: node.id, parentId, index: index + 1 }),
                  )
                }
              >
                下
              </button>
              <button type="button" className="btn btn-secondary min-h-11 px-2 text-xs" onClick={() => onMove(moveId === node.id ? "" : node.id)}>
                移动
              </button>
            </div>
            {moveId === node.id && node.documentId ? (
              <DocumentDestinations
                library={library}
                documentId={node.documentId}
                onRun={onRun}
              />
            ) : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

function DocumentDestinations({
  library,
  documentId,
  onRun,
}: {
  library: DocsLibrarySnapshot;
  documentId: string;
  onRun: (label: string, work: () => Promise<DocsLibrarySnapshot>) => Promise<void>;
}) {
  return (
    <div className="mt-1 grid gap-1">
      <button
        type="button"
        className="btn btn-secondary min-h-11 justify-start px-3 text-xs"
        onClick={() => void onRun(documentId, () => applyDocsWiki({ action: "unplaceDocument", documentId }))}
      >
        移回未分类
      </button>
      {library.spaces.map((space) => (
        <div key={space.id} className="grid gap-1">
          <button
            type="button"
            className="btn btn-secondary min-h-11 justify-start px-3 text-xs"
            onClick={() =>
              void onRun(documentId, () =>
                applyDocsWiki({ action: "placeDocument", documentId, spaceId: space.id, parentId: null }),
              )
            }
          >
            {space.name} / 根目录
          </button>
          {library.nodes
            .filter((node) => node.spaceId === space.id && node.kind === "folder" && node.status === "active")
            .map((folder) => (
              <button
                key={folder.id}
                type="button"
                className="btn btn-secondary min-h-11 justify-start px-3 text-xs"
                onClick={() =>
                  void onRun(documentId, () =>
                    applyDocsWiki({
                      action: "placeDocument",
                      documentId,
                      spaceId: space.id,
                      parentId: folder.id,
                    }),
                  )
                }
              >
                {space.name} / {folder.name}
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}

function FolderDestinations({
  library,
  spaceId,
  nodeId,
  onRun,
}: {
  library: DocsLibrarySnapshot;
  spaceId: string;
  nodeId: string;
  onRun: (label: string, work: () => Promise<DocsLibrarySnapshot>) => Promise<void>;
}) {
  const folders = library.nodes.filter(
    (node) => node.spaceId === spaceId && node.kind === "folder" && node.status === "active" && node.id !== nodeId,
  );
  return (
    <div className="mt-1 grid gap-1">
      <button
        type="button"
        className="btn btn-secondary min-h-11 justify-start px-3 text-xs"
        onClick={() => void onRun(nodeId, () => applyDocsWiki({ action: "moveNode", nodeId, parentId: null }))}
      >
        移到知识库根目录
      </button>
      {folders.map((folder) => (
        <button
          key={folder.id}
          type="button"
          className="btn btn-secondary min-h-11 justify-start px-3 text-xs"
          onClick={() =>
            void onRun(nodeId, () => applyDocsWiki({ action: "moveNode", nodeId, parentId: folder.id }))
          }
        >
          移到 {folder.name}
        </button>
      ))}
    </div>
  );
}

export function documentBreadcrumb(library: DocsLibrarySnapshot | null, documentId: string, title: string) {
  if (!library) return [{ label: "颗秒文档", href: "/products/docs" }, { label: title, href: null }];
  return breadcrumbForDocument({
    spaces: library.spaces,
    nodes: library.nodes,
    documentId,
    documentTitle: title,
  });
}
