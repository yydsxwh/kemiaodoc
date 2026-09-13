import {
  ANDYYYDS_LOCAL_STORAGE_KEY,
  DEFAULT_LOCAL_STORAGE_KEY,
  LOCAL_DOC_ID,
  createEmptyDocument,
  isBrowserOnline,
  isNetworkSaveError,
  markLiveSnapshotSynced,
  readLiveSnapshot,
  sanitizeDocument,
  snapshotIsNewer,
  writeLiveSnapshot,
  type DocNode,
  type KemiaoDocument,
  type ListScheme,
  type PageChrome,
} from "@kemiaodoc/core"

export type DocumentPatch = {
  title?: string
  content?: DocNode
  listScheme?: ListScheme
  pageChrome?: PageChrome
}

export type SaveOptions = {
  keepalive?: boolean
}

export type StorageAdapter = {
  load?(id: string): Promise<KemiaoDocument | null> | KemiaoDocument | null
  save(
    id: string,
    patch: DocumentPatch,
    options?: SaveOptions,
  ): Promise<KemiaoDocument | void> | KemiaoDocument | void
  create?(doc: DocumentPatch): Promise<KemiaoDocument>
  remove?(id: string): Promise<void>
  list?(): Promise<KemiaoDocument[]> | KemiaoDocument[]
}

export type ImageUploader = (file: File) => Promise<string>

export type DocxBridge = {
  importFile?(file: File): Promise<{ title: string; content: DocNode }>
  exportFile?(doc: Pick<KemiaoDocument, "title" | "content" | "pageChrome">): Promise<Blob>
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function downloadText(content: string, fileName: string, mime: string) {
  downloadBlob(new Blob([content], { type: `${mime};charset=utf-8` }), fileName)
}

function readLocal(key: string, fallbackId = LOCAL_DOC_ID): KemiaoDocument {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return createEmptyDocument(fallbackId)
    return sanitizeDocument(JSON.parse(raw), fallbackId)
  } catch {
    return createEmptyDocument(fallbackId)
  }
}

export function createLocalStorageAdapter(options?: {
  key?: string
  migrateFrom?: string
}): StorageAdapter {
  const key = options?.key ?? DEFAULT_LOCAL_STORAGE_KEY
  const migrateFrom = options?.migrateFrom ?? ANDYYYDS_LOCAL_STORAGE_KEY

  const ensure = () => {
    if (typeof localStorage === "undefined") return createEmptyDocument()
    if (!localStorage.getItem(key) && migrateFrom && localStorage.getItem(migrateFrom)) {
      localStorage.setItem(key, localStorage.getItem(migrateFrom) || "")
    }
    return readLocal(key)
  }

  return {
    load: (id) => {
      const current = ensure()
      return current.id === id || id === LOCAL_DOC_ID ? current : null
    },
    save: (id, patch) => {
      const current = ensure()
      const next = sanitizeDocument(
        {
          ...current,
          ...patch,
          id: current.id || id || LOCAL_DOC_ID,
          updatedAt: new Date().toISOString(),
        },
        LOCAL_DOC_ID,
      )
      localStorage.setItem(key, JSON.stringify(next))
      return next
    },
    list: () => [ensure()],
  }
}

export function createHttpAdapter(options?: {
  baseUrl?: string
  credentials?: RequestCredentials
}): StorageAdapter & { uploadImage: ImageUploader; importDocx: NonNullable<DocxBridge["importFile"]>; exportDocx: NonNullable<DocxBridge["exportFile"]> } {
  const base = (options?.baseUrl ?? "").replace(/\/$/, "")
  const credentials = options?.credentials ?? "same-origin"

  async function readJson(response: Response) {
    try {
      return await response.json()
    } catch {
      return {}
    }
  }

  function errorMessage(payload: unknown, fallback: string) {
    if (payload && typeof payload === "object" && "error" in payload) {
      const message = String((payload as { error?: string }).error || "").trim()
      if (message) return message
    }
    return fallback
  }

  return {
    async create(doc) {
      const response = await fetch(`${base}/api/docs`, {
        method: "POST",
        credentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc || {}),
      })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(payload, "无法新建文档"))
      return sanitizeDocument(payload)
    },
    async save(id, patch, options) {
      const response = await fetch(`${base}/api/docs/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
        keepalive: Boolean(options?.keepalive),
      })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(payload, "保存失败"))
      return sanitizeDocument(payload, id)
    },
    async remove(id) {
      const response = await fetch(`${base}/api/docs/${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials,
      })
      if (!response.ok) throw new Error(errorMessage(await readJson(response), "删除失败"))
    },
    async load(id) {
      const response = await fetch(`${base}/api/docs/${encodeURIComponent(id)}`, { credentials })
      if (!response.ok) return null
      return sanitizeDocument(await readJson(response), id)
    },
    async list() {
      const response = await fetch(`${base}/api/docs`, { credentials })
      if (!response.ok) return []
      const payload = await readJson(response)
      const items = Array.isArray(payload) ? payload : payload.documents || payload.items || []
      return items.map((item: unknown) => sanitizeDocument(item))
    },
    async uploadImage(file) {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(`${base}/api/upload/image`, { method: "POST", credentials, body })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(payload, "图片上传失败"))
      return String(payload.previewUrl || payload.url || "")
    },
    async importDocx(file) {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch(`${base}/api/docs/import`, { method: "POST", credentials, body })
      const payload = await readJson(response)
      if (!response.ok) throw new Error(errorMessage(payload, "打开文件失败"))
      return { title: String(payload.title || file.name), content: payload.content }
    },
    async exportDocx(doc) {
      const response = await fetch(`${base}/api/docs/export`, {
        method: "POST",
        credentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      })
      if (!response.ok) throw new Error(errorMessage(await readJson(response), "另存为 Word 失败"))
      return response.blob()
    },
  }
}

/** 本机多篇「云端」库，演示和没接 API 的产品也能练自动同步。 */
export function createLocalVaultAdapter(options?: { key?: string }): StorageAdapter {
  const key = options?.key ?? "kemiaodoc-cloud-vault-v1"

  const readMap = (): Record<string, KemiaoDocument> => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const next: Record<string, KemiaoDocument> = {}
      for (const [id, value] of Object.entries(parsed)) {
        next[id] = sanitizeDocument(value, id)
      }
      return next
    } catch {
      return {}
    }
  }

  const writeMap = (map: Record<string, KemiaoDocument>) => {
    localStorage.setItem(key, JSON.stringify(map))
  }

  return {
    list: () =>
      Object.values(readMap()).sort((left, right) =>
        String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")),
      ),
    load: (id) => readMap()[id] || null,
    save: (id, patch) => {
      const map = readMap()
      const current = map[id] || createEmptyDocument(id)
      const next = sanitizeDocument(
        {
          ...current,
          ...patch,
          id,
          updatedAt: new Date().toISOString(),
        },
        id,
      )
      map[id] = next
      writeMap(map)
      return next
    },
    async create(doc) {
      const id = `cloud-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())}`
      const map = readMap()
      const next = sanitizeDocument(
        {
          ...doc,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        id,
      )
      map[id] = next
      writeMap(map)
      return next
    },
    async remove(id) {
      const map = readMap()
      delete map[id]
      writeMap(map)
    },
  }
}

/** 没网时让远程保存失败，走本机快照。 */
export function createOnlineGate(remote: StorageAdapter): StorageAdapter {
  const guard = () => {
    if (!isBrowserOnline()) throw new TypeError("Failed to fetch")
  }
  return {
    load: (id) => {
      guard()
      return remote.load?.(id) ?? null
    },
    save: (id, patch, options) => {
      guard()
      return remote.save(id, patch, options)
    },
    async create(doc) {
      guard()
      if (!remote.create) throw new Error("无法新建文档")
      return remote.create(doc)
    },
    async remove(id) {
      guard()
      await remote.remove?.(id)
    },
    list: () => {
      guard()
      return remote.list?.() ?? []
    },
  }
}

/** 先写本机快照，再尽量同步远程；关页、死机、断网都能找回。 */
export function createDurableAdapter(remote: StorageAdapter): StorageAdapter {
  return {
    async load(id) {
      let remoteDoc: KemiaoDocument | null = null
      try {
        remoteDoc = (await remote.load?.(id)) ?? null
      } catch {
        remoteDoc = null
      }
      const live = readLiveSnapshot(id)
      if (live && snapshotIsNewer(live.updatedAt, remoteDoc?.updatedAt)) return live
      return remoteDoc || live
    },
    async save(id, patch, options) {
      const previous = readLiveSnapshot(id) || createEmptyDocument(id)
      writeLiveSnapshot({
        ...previous,
        ...patch,
        id,
        pendingCloud: true,
        updatedAt: new Date().toISOString(),
      })
      try {
        const saved = await remote.save(id, patch, options)
        markLiveSnapshotSynced(id)
        return saved || readLiveSnapshot(id) || previous
      } catch (error) {
        if (isNetworkSaveError(error)) {
          return readLiveSnapshot(id) || previous
        }
        throw error
      }
    },
    async create(doc) {
      writeLiveSnapshot({
        ...(readLiveSnapshot(LOCAL_DOC_ID) || createEmptyDocument()),
        ...doc,
        id: LOCAL_DOC_ID,
        pendingCloud: true,
        updatedAt: new Date().toISOString(),
      })
      if (!remote.create) throw new Error("无法新建文档")
      const created = await remote.create(doc)
      writeLiveSnapshot({ ...created, pendingCloud: false })
      return created
    },
    async remove(id) {
      await remote.remove?.(id)
    },
    async list() {
      let items: KemiaoDocument[] = []
      try {
        items = (await remote.list?.()) || []
      } catch {
        items = []
      }
      const live = readLiveSnapshot(LOCAL_DOC_ID)
      if (!live) return items
      const index = items.findIndex((item) => item.id === live.id || item.id === LOCAL_DOC_ID)
      if (index >= 0) {
        if (snapshotIsNewer(live.updatedAt, items[index].updatedAt)) items[index] = live
      } else {
        items.unshift(live)
      }
      return items
    },
  }
}
