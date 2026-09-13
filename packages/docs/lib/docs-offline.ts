/**
 * 正在写的文档先同步落到本机。关页、死机、没网时，至少还能找回最近一次击键。
 */

import {
  clampDocsTitle,
  DOCS_LOCAL_ID,
  emptyDocsContent,
  sanitizeDocsContent,
  type DocsDocumentPayload,
  type DocsJsonNode,
} from "@kemiaodoc/docs/lib/docs-content";
import { docsContentToPlainText } from "@kemiaodoc/docs/lib/docs-html";
import {
  DEFAULT_DOCS_PAGE_CHROME,
  normalizePageChrome,
  type DocsPageChrome,
} from "@kemiaodoc/docs/lib/docs-page";
import {
  DEFAULT_DOCS_LIST_SCHEME,
  normalizeListScheme,
  type DocsListScheme,
} from "@kemiaodoc/docs/lib/docs-scheme";

export const DOCS_LIVE_SNAPSHOT_PREFIX = "kemiaodoc-live-v1:";

export type DocsSnapshotStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type DocsLiveSnapshot = DocsDocumentPayload & {
  pendingCloud?: boolean;
  degraded?: boolean;
};

export function docsLiveSnapshotKey(id: string): string {
  return `${DOCS_LIVE_SNAPSHOT_PREFIX}${id || DOCS_LOCAL_ID}`;
}

export function createDocsMemorySnapshotStore(
  initial?: Record<string, string>,
): DocsSnapshotStore {
  const data = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function browserStore(): DocsSnapshotStore | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function resolveStore(store?: DocsSnapshotStore | null): DocsSnapshotStore | null {
  return store ?? browserStore();
}

function textOnlyContent(content: DocsJsonNode): DocsJsonNode {
  const text = docsContentToPlainText(content);
  return {
    type: "doc",
    content: text
      ? text.split(/\n+/).map((line) => ({
          type: "paragraph",
          content: line ? [{ type: "text", text: line }] : [],
        }))
      : [{ type: "paragraph" }],
  };
}

function normalizeSnapshot(
  raw: Partial<DocsLiveSnapshot>,
  fallbackId: string,
): DocsLiveSnapshot {
  return {
    id: String(raw.id || fallbackId || DOCS_LOCAL_ID),
    title: clampDocsTitle(raw.title),
    content: sanitizeDocsContent(raw.content || emptyDocsContent()),
    listScheme: normalizeListScheme(raw.listScheme || DEFAULT_DOCS_LIST_SCHEME),
    pageChrome: normalizePageChrome(raw.pageChrome || DEFAULT_DOCS_PAGE_CHROME),
    updatedAt: raw.updatedAt || new Date().toISOString(),
    createdAt: raw.createdAt,
    pendingCloud: Boolean(raw.pendingCloud),
    degraded: Boolean(raw.degraded),
  };
}

export function writeDocsLiveSnapshot(
  input: {
    id: string;
    title: string;
    content: DocsJsonNode;
    listScheme: DocsListScheme;
    pageChrome: DocsPageChrome;
    pendingCloud?: boolean;
    createdAt?: string;
  },
  store?: DocsSnapshotStore | null,
): { ok: boolean; degraded: boolean; snapshot: DocsLiveSnapshot } {
  const snapshot = normalizeSnapshot(
    { ...input, updatedAt: new Date().toISOString() },
    input.id,
  );
  const target = resolveStore(store);
  if (!target) return { ok: false, degraded: false, snapshot };
  const key = docsLiveSnapshotKey(snapshot.id);
  try {
    target.setItem(key, JSON.stringify({ ...snapshot, degraded: false }));
    return { ok: true, degraded: false, snapshot };
  } catch {
    const degraded = normalizeSnapshot(
      {
        ...snapshot,
        content: textOnlyContent(snapshot.content),
        degraded: true,
      },
      snapshot.id,
    );
    try {
      target.setItem(key, JSON.stringify(degraded));
      return { ok: true, degraded: true, snapshot: degraded };
    } catch {
      return { ok: false, degraded: false, snapshot };
    }
  }
}

export function readDocsLiveSnapshot(
  id: string,
  store?: DocsSnapshotStore | null,
): DocsLiveSnapshot | null {
  const target = resolveStore(store);
  if (!target) return null;
  try {
    const raw = target.getItem(docsLiveSnapshotKey(id));
    if (!raw) return null;
    return normalizeSnapshot(JSON.parse(raw) as Partial<DocsLiveSnapshot>, id);
  } catch {
    return null;
  }
}

export function adoptDocsLiveSnapshot(
  fromId: string,
  toId: string,
  store?: DocsSnapshotStore | null,
): DocsLiveSnapshot | null {
  const current = readDocsLiveSnapshot(fromId, store);
  if (!current) return null;
  writeDocsLiveSnapshot({ ...current, id: toId, pendingCloud: false }, store);
  if (fromId !== toId) {
    resolveStore(store)?.removeItem(docsLiveSnapshotKey(fromId));
  }
  return readDocsLiveSnapshot(toId, store);
}

export function markDocsLiveSnapshotSynced(
  id: string,
  store?: DocsSnapshotStore | null,
): void {
  const current = readDocsLiveSnapshot(id, store);
  if (!current) return;
  const target = resolveStore(store);
  if (!target) return;
  try {
    target.setItem(
      docsLiveSnapshotKey(id),
      JSON.stringify({ ...current, pendingCloud: false }),
    );
  } catch {
    /* 同步标记失败不影响稿本身 */
  }
}

export function pickNewerDocsSource(
  live: DocsLiveSnapshot | null,
  remote: DocsDocumentPayload,
): DocsDocumentPayload {
  if (!live) return remote;
  const liveTime = Date.parse(live.updatedAt || "");
  const remoteTime = Date.parse(remote.updatedAt || "");
  if (Number.isNaN(liveTime)) return remote;
  if (Number.isNaN(remoteTime) || liveTime > remoteTime) return live;
  return remote;
}
