import { createEmptyDocument, LOCAL_DOC_ID, type KemiaoDocument } from "@kemiaodoc/core"
import { useEffect, useState } from "react"
import type { StorageAdapter } from "./adapters"

export function DocsWorkspace({
  title = "网页文档",
  description = "在浏览器里写文档：标题、正文、加粗、多级标题、项目符号、可自定义的多级编号、插图和简单表格。可打开 Word / HTML / 文本，另存为 Word 或 HTML，并设置页眉页脚页码后打印。",
  storage,
  onOpen,
  onCreateCloud,
  loggedIn = false,
}: {
  title?: string
  description?: string
  storage?: StorageAdapter
  onOpen: (doc: KemiaoDocument) => void
  onCreateCloud?: () => Promise<KemiaoDocument> | KemiaoDocument
  loggedIn?: boolean
}) {
  const [docs, setDocs] = useState<KemiaoDocument[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!storage?.list) return
    Promise.resolve(storage.list())
      .then((items) => setDocs(items || []))
      .catch(() => setDocs([]))
  }, [storage])

  return (
    <div className="kemiaodoc-root">
      <div className="kd-surface p-5 sm:p-8">
        <p className="text-sm" style={{ color: "var(--kd-muted)" }}>
          软件产品 · 网页文档
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: "var(--kd-muted)" }}>
          {description}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            className="kd-btn kd-btn-primary min-h-11 px-4 text-sm"
            disabled={busy}
            onClick={() => {
              const draft = createEmptyDocument(LOCAL_DOC_ID)
              onOpen(draft)
            }}
          >
            打开浏览器草稿
          </button>
          {loggedIn && onCreateCloud ? (
            <button
              type="button"
              className="kd-btn kd-btn-secondary min-h-11 px-4 text-sm"
              disabled={busy}
              onClick={() => {
                setBusy(true)
                setError("")
                Promise.resolve(onCreateCloud())
                  .then(onOpen)
                  .catch((err) => setError(err instanceof Error ? err.message : "新建失败"))
                  .finally(() => setBusy(false))
              }}
            >
              {busy ? "创建中…" : "新建云端文档"}
            </button>
          ) : (
            <p className="self-center text-sm" style={{ color: "var(--kd-muted)" }}>
              未登录也可以先在浏览器里写；换设备或清缓存会丢。登录后可保存多篇到云端。
            </p>
          )}
        </div>
        {error ? (
          <p className="mt-3 text-sm" style={{ color: "var(--kd-fire)" }}>
            {error}
          </p>
        ) : null}
        {docs.length ? (
          <ul className="mt-8 grid gap-3">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="kd-btn kd-btn-secondary min-h-11 w-full justify-start px-4 text-left"
                  onClick={() => onOpen(doc)}
                >
                  <span className="block font-medium">{doc.title}</span>
                  <span className="block text-xs" style={{ color: "var(--kd-muted)" }}>
                    {doc.id === LOCAL_DOC_ID ? "浏览器草稿" : "云端文档"}
                    {doc.updatedAt ? ` · ${new Date(doc.updatedAt).toLocaleString()}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
