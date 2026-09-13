import { sanitizeDocument, sanitizeTitle } from "./document"
import { contentToPlainText } from "./html"
import type { KemiaoDocument } from "./types"
import { LOCAL_DOC_ID } from "./types"

export const LIVE_SNAPSHOT_PREFIX = "kemiaodoc-live-v1:"

export type SnapshotStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export type LiveSnapshot = KemiaoDocument & {
  pendingCloud?: boolean
  degraded?: boolean
}

export function liveSnapshotKey(id: string): string {
  return `${LIVE_SNAPSHOT_PREFIX}${id || LOCAL_DOC_ID}`
}

export function createMemorySnapshotStore(initial?: Record<string, string>): SnapshotStore {
  const data = new Map(Object.entries(initial || {}))
  return {
    getItem: (key) => (data.has(key) ? data.get(key)! : null),
    setItem: (key, value) => {
      data.set(key, value)
    },
    removeItem: (key) => {
      data.delete(key)
    },
  }
}

export function browserSnapshotStore(): SnapshotStore | null {
  try {
    if (typeof localStorage === "undefined") return null
    return localStorage
  } catch {
    return null
  }
}

function resolveStore(store?: SnapshotStore | null): SnapshotStore | null {
  return store ?? browserSnapshotStore()
}

function textOnlyDocument(doc: KemiaoDocument): KemiaoDocument {
  const text = contentToPlainText(doc.content)
  return {
    ...doc,
    title: sanitizeTitle(doc.title),
    content: {
      type: "doc",
      content: text
        ? text.split(/\n+/).map((line) => ({
            type: "paragraph" as const,
            content: line ? [{ type: "text" as const, text: line }] : [],
          }))
        : [{ type: "paragraph" }],
    },
  }
}

export function writeLiveSnapshot(
  input: LiveSnapshot,
  store?: SnapshotStore | null,
): { ok: boolean; degraded: boolean } {
  const target = resolveStore(store)
  if (!target) return { ok: false, degraded: false }
  const doc = sanitizeDocument(input, input.id || LOCAL_DOC_ID)
  const payload: LiveSnapshot = {
    ...doc,
    pendingCloud: Boolean(input.pendingCloud),
    degraded: false,
  }
  const key = liveSnapshotKey(payload.id)
  try {
    target.setItem(key, JSON.stringify(payload))
    return { ok: true, degraded: false }
  } catch {
    try {
      const degraded: LiveSnapshot = {
        ...textOnlyDocument(payload),
        pendingCloud: payload.pendingCloud,
        degraded: true,
      }
      target.setItem(key, JSON.stringify(degraded))
      return { ok: true, degraded: true }
    } catch {
      return { ok: false, degraded: false }
    }
  }
}

export function readLiveSnapshot(id: string, store?: SnapshotStore | null): LiveSnapshot | null {
  const target = resolveStore(store)
  if (!target) return null
  try {
    const raw = target.getItem(liveSnapshotKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as LiveSnapshot
    const doc = sanitizeDocument(parsed, id)
    return {
      ...doc,
      pendingCloud: Boolean(parsed.pendingCloud),
      degraded: Boolean(parsed.degraded),
    }
  } catch {
    return null
  }
}

export function clearLiveSnapshot(id: string, store?: SnapshotStore | null): void {
  resolveStore(store)?.removeItem(liveSnapshotKey(id))
}

export function markLiveSnapshotSynced(id: string, store?: SnapshotStore | null): void {
  const current = readLiveSnapshot(id, store)
  if (!current) return
  writeLiveSnapshot({ ...current, pendingCloud: false }, store)
}
