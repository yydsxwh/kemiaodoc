import { Extension } from "@tiptap/core"
import Image from "@tiptap/extension-image"
import Placeholder from "@tiptap/extension-placeholder"
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  LOCAL_DOC_ID,
  contentToPlainText,
  detectTextKind,
  documentToStandaloneHtml,
  downloadFileName,
  importTextFile,
  listSchemeCss,
  sanitizeContent,
  sanitizeListScheme,
  sanitizePageChrome,
  sanitizeTitle,
  type DocNode,
  type KemiaoDocument,
} from "@kemiaodoc/core"
import { ListSchemePanel } from "./ListSchemePanel"
import { PageChromePanel } from "./PageChromePanel"
import { PrintPreview } from "./PrintPreview"
import {
  createLocalStorageAdapter,
  downloadBlob,
  downloadText,
  type DocxBridge,
  type ImageUploader,
  type StorageAdapter,
} from "./adapters"

const DocsTabList = Extension.create({
  name: "docsTabList",
  addKeyboardShortcuts() {
    return {
      Tab: () => this.editor.commands.sinkListItem("listItem"),
      "Shift-Tab": () => this.editor.commands.liftListItem("listItem"),
    }
  },
})

function imageFiles(list?: FileList | null): File[] {
  return list ? Array.from(list).filter((file) => file.type.startsWith("image/")) : []
}

export type DocsEditorProps = {
  initial: KemiaoDocument
  loggedIn?: boolean
  homeHref?: string
  storage?: StorageAdapter
  uploadImage?: ImageUploader
  docx?: DocxBridge
  onNavigateHome?: () => void
  onCloudCreated?: (id: string) => void
  className?: string
}

export function DocsEditor({
  initial,
  loggedIn = false,
  homeHref = "#/",
  storage,
  uploadImage,
  docx,
  onNavigateHome,
  onCloudCreated,
  className,
}: DocsEditorProps) {
  const persist = storage ?? createLocalStorageAdapter()
  const [title, setTitle] = useState(initial.title)
  const [listScheme, setListScheme] = useState(() => sanitizeListScheme(initial.listScheme))
  const [pageChrome, setPageChrome] = useState(() => sanitizePageChrome(initial.pageChrome))
  const [schemeOpen, setSchemeOpen] = useState(false)
  const [chromeOpen, setChromeOpen] = useState(false)
  const [printOpen, setPrintOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle")
  const [error, setError] = useState("")
  const [docId, setDocId] = useState(initial.id)
  const imageInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const titleRef = useRef(title)
  const schemeRef = useRef(listScheme)
  const chromeRef = useRef(pageChrome)
  const statusRef = useRef(status)
  const [, bump] = useState(0)

  titleRef.current = title
  schemeRef.current = listScheme
  chromeRef.current = pageChrome
  statusRef.current = status

  const schemeCss = useMemo(() => listSchemeCss(listScheme), [listScheme])

  const insertImage = useCallback(
    async (editor: Editor, file: File) => {
      if (!file.type.startsWith("image/")) return
      if (uploadImage) {
        const src = await uploadImage(file)
        editor.chain().focus().setImage({ src, alt: file.name }).run()
        return
      }
      if (file.size > 1_572_864 && !loggedIn) throw new Error("未登录插图请小于 1.5MB，或登录后上传")
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ""))
        reader.onerror = () => reject(new Error("读图失败"))
        reader.readAsDataURL(file)
      })
      editor.chain().focus().setImage({ src, alt: file.name }).run()
    },
    [loggedIn, uploadImage],
  )

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        codeBlock: false,
        code: false,
      }),
      Image.configure({ inline: false, allowBase64: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: "写正文，或用工具栏加标题、列表、图片和表格" }),
      DocsTabList,
    ],
    content: initial.content,
    editorProps: {
      attributes: { class: "docs-prose" },
      handlePaste: (_view, event) => {
        const current = editorRef.current
        const files = imageFiles(event.clipboardData?.files)
        if (!files.length || !current) return false
        event.preventDefault()
        insertImage(current, files[0]).catch((err) => setError(err instanceof Error ? err.message : "插图失败"))
        return true
      },
      handleDrop: (_view, event) => {
        const current = editorRef.current
        const files = imageFiles(event.dataTransfer?.files)
        if (!files.length || !current) return false
        event.preventDefault()
        insertImage(current, files[0]).catch((err) => setError(err instanceof Error ? err.message : "插图失败"))
        return true
      },
    },
    onUpdate: () => setStatus("dirty"),
    onSelectionUpdate: () => bump((value) => value + 1),
  })

  editorRef.current = editor

  useEffect(() => {
    if (!editor) return
    const next =
      initial.id === LOCAL_DOC_ID && persist.load
        ? persist.load(LOCAL_DOC_ID)
        : initial
    Promise.resolve(next).then((loaded) => {
      const doc = loaded || initial
      if (JSON.stringify(editor.getJSON()) !== JSON.stringify(doc.content)) {
        editor.commands.setContent(doc.content, false)
      }
      setTitle(doc.title)
      setListScheme(sanitizeListScheme(doc.listScheme))
      setPageChrome(sanitizePageChrome(doc.pageChrome))
      setDocId(doc.id)
      setStatus("idle")
    })
  }, [editor, initial, persist])

  const save = useCallback(async () => {
    if (!editor) return
    const content = editor.getJSON() as DocNode
    setStatus("saving")
    setError("")
    try {
      if (!loggedIn || docId === LOCAL_DOC_ID) {
        await persist.save(LOCAL_DOC_ID, {
          title: titleRef.current,
          content,
          listScheme: schemeRef.current,
          pageChrome: chromeRef.current,
        })
        setStatus("saved")
        return
      }
      await persist.save(docId, {
        title: titleRef.current,
        content,
        listScheme: schemeRef.current,
        pageChrome: chromeRef.current,
      })
      setStatus("saved")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "保存失败")
    }
  }, [docId, editor, loggedIn, persist])

  const saveNow = useCallback(() => {
    if (statusRef.current !== "saving") void save()
  }, [save])

  useEffect(() => {
    if (status !== "dirty") return
    const timer = window.setTimeout(() => {
      void save()
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [save, status, title, listScheme, pageChrome])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.altKey && event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        event.stopPropagation()
        saveNow()
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [saveNow])

  const currentContent = () => (editor?.getJSON() as DocNode) || { type: "doc", content: [{ type: "paragraph" }] }

  const applyImported = (nextTitle: string, content: DocNode) => {
    if (!editor) return
    editor.commands.setContent(content, false)
    setTitle(nextTitle.slice(0, 80))
    setStatus("dirty")
  }

  const openFile = async (file?: File) => {
    if (!file) return
    const name = file.name.toLowerCase()
    try {
      if (/\.(docx|wps)$/i.test(name)) {
        if (!docx?.importFile) throw new Error("当前环境未接入 Word 导入")
        const imported = await docx.importFile(file)
        applyImported(imported.title, imported.content)
        return
      }
      if (/\.doc$/i.test(name)) throw new Error("旧版 .doc 打不开，请另存为 .docx")
      const text = await file.text()
      applyImported(
        file.name.replace(/\.[^.]+$/, "").trim() || "导入文档",
        importTextFile(text, detectTextKind(file.name)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "打开文件失败")
    }
  }

  const exportWord = async () => {
    try {
      if (!docx?.exportFile) throw new Error("当前环境未接入 Word 导出")
      const blob = await docx.exportFile({
        title: titleRef.current,
        content: currentContent(),
        pageChrome: chromeRef.current,
      })
      downloadBlob(blob, downloadFileName(titleRef.current, "docx"))
      setSaveOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "另存为 Word 失败")
    }
  }

  const run = (fn: (editor: Editor) => void) => {
    if (!editor) return
    fn(editor)
    editor.chain().focus().run()
  }

  const saveToCloud = async () => {
    if (!editor || !persist.create) return
    setStatus("saving")
    setError("")
    try {
      const created = await persist.create({
        title: titleRef.current,
        content: editor.getJSON() as DocNode,
        listScheme: schemeRef.current,
        pageChrome: chromeRef.current,
      })
      if (onCloudCreated) onCloudCreated(created.id)
      else window.location.hash = `#/docs/${created.id}`
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "保存到云端失败")
    }
  }

  const removeDoc = async () => {
    if (docId === LOCAL_DOC_ID || !persist.remove) return
    if (!window.confirm("删除后不能恢复，确定删这篇？")) return
    try {
      await persist.remove(docId)
      onNavigateHome?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败")
    }
  }

  const headingValue = (() => {
    if (!editor) return "0"
    for (let level = 1; level <= 6; level += 1) {
      if (editor.isActive("heading", { level })) return String(level)
    }
    return "0"
  })()

  const inTable = Boolean(editor?.isActive("table"))
  const statusText =
    status === "saving"
      ? "保存中…"
      : status === "saved"
        ? loggedIn && docId !== LOCAL_DOC_ID
          ? "已保存到云端"
          : "已写入浏览器"
        : status === "dirty"
          ? "有未保存改动"
          : status === "error"
            ? "保存失败"
            : "已就绪"

  return (
    <div className={`kemiaodoc-root ${className || ""}`}>
      <div className="kd-surface">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-3 sm:px-5" style={{ borderColor: "var(--kd-line)" }}>
          {onNavigateHome ? (
            <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={onNavigateHome}>
              全部文档
            </button>
          ) : (
            <a href={homeHref} className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm">
              全部文档
            </a>
          )}
          <span className="text-xs" style={{ color: "var(--kd-muted)" }}>
            {statusText}
          </span>
          <button
            type="button"
            className="kd-btn kd-btn-primary min-h-11 px-3 text-sm"
            disabled={status === "saving"}
            title="保存（Ctrl+S）"
            onClick={saveNow}
          >
            {status === "saving" ? "保存中…" : status === "saved" ? "已保存" : "保存"}
            <span className="ml-1 hidden text-[11px] font-normal opacity-80 sm:inline">Ctrl+S</span>
          </button>
          {docId === LOCAL_DOC_ID && loggedIn && persist.create ? (
            <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => void saveToCloud()}>
              保存到云端
            </button>
          ) : null}
          <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => fileInput.current?.click()}>
            打开文件
          </button>
          <div className="relative">
            <button
              type="button"
              className={`kd-btn min-h-11 px-3 text-sm ${saveOpen ? "kd-btn-primary" : "kd-btn-secondary"}`}
              aria-expanded={saveOpen}
              onClick={() => setSaveOpen((open) => !open)}
            >
              另存为
            </button>
            {saveOpen ? (
              <div className="absolute left-0 z-30 mt-1 min-w-[10rem] rounded-2xl border bg-white p-2 shadow-lg" style={{ borderColor: "var(--kd-line)" }}>
                <button
                  type="button"
                  className="kd-btn kd-btn-secondary min-h-11 w-full justify-start px-3 text-sm"
                  onClick={() => {
                    downloadText(
                      documentToStandaloneHtml({
                        title: titleRef.current,
                        content: sanitizeContent(currentContent()),
                        listScheme: schemeRef.current,
                        pageChrome: chromeRef.current,
                      }),
                      downloadFileName(titleRef.current, "html"),
                      "text/html",
                    )
                    setSaveOpen(false)
                  }}
                >
                  HTML
                </button>
                <button
                  type="button"
                  className="kd-btn kd-btn-secondary mt-1 min-h-11 w-full justify-start px-3 text-sm"
                  onClick={() => void exportWord()}
                >
                  Word（.docx）
                </button>
                <button
                  type="button"
                  className="kd-btn kd-btn-secondary mt-1 min-h-11 w-full justify-start px-3 text-sm"
                  onClick={() => {
                    downloadText(
                      contentToPlainText(sanitizeContent(currentContent())),
                      downloadFileName(titleRef.current, "txt"),
                      "text/plain",
                    )
                    setSaveOpen(false)
                  }}
                >
                  纯文本
                </button>
              </div>
            ) : null}
          </div>
          <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => setPrintOpen(true)}>
            打印预览
          </button>
          {docId !== LOCAL_DOC_ID && persist.remove ? (
            <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => void removeDoc()}>
              删除
            </button>
          ) : null}
          <input
            ref={fileInput}
            type="file"
            accept=".docx,.wps,.doc,.html,.htm,.txt,.md"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              void openFile(file)
            }}
          />
        </div>

        <label className="block border-b px-3 py-3 sm:px-5" style={{ borderColor: "var(--kd-line)" }}>
          <span className="sr-only">文档标题</span>
          <input
            className="w-full bg-transparent text-xl font-semibold outline-none sm:text-2xl"
            value={title}
            maxLength={80}
            onChange={(event) => {
              setTitle(event.target.value.slice(0, 80))
              setStatus("dirty")
            }}
            placeholder="文档标题"
          />
        </label>

        <div className="docs-toolbar">
          <label className="sr-only" htmlFor="docs-heading">
            段落样式
          </label>
          <select
            id="docs-heading"
            className="kd-field min-h-11 min-w-[7.5rem] rounded-xl px-3 text-sm"
            value={headingValue}
            onChange={(event) => {
              const level = Number(event.target.value)
              if (!editor) return
              if (level) editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run()
              else editor.chain().focus().setParagraph().run()
            }}
          >
            <option value="0">正文</option>
            <option value="1">标题 1</option>
            <option value="2">标题 2</option>
            <option value="3">标题 3</option>
            <option value="4">标题 4</option>
            <option value="5">标题 5</option>
            <option value="6">标题 6</option>
          </select>
          <button
            type="button"
            className={`kd-btn min-h-11 px-3 text-sm ${editor?.isActive("bold") ? "kd-btn-primary" : "kd-btn-secondary"}`}
            onClick={() => run((current) => current.chain().toggleBold().run())}
          >
            加粗
          </button>
          <button
            type="button"
            className={`kd-btn min-h-11 px-3 text-sm ${editor?.isActive("bulletList") ? "kd-btn-primary" : "kd-btn-secondary"}`}
            onClick={() => run((current) => current.chain().toggleBulletList().run())}
          >
            项目符号
          </button>
          <button
            type="button"
            className={`kd-btn min-h-11 px-3 text-sm ${editor?.isActive("orderedList") ? "kd-btn-primary" : "kd-btn-secondary"}`}
            onClick={() => run((current) => current.chain().toggleOrderedList().run())}
          >
            项目编号
          </button>
          <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().liftListItem("listItem").run())}>
            升级
          </button>
          <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().sinkListItem("listItem").run())}>
            降级
          </button>
          <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => imageInput.current?.click()}>
            插图
          </button>
          <button
            type="button"
            className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm"
            onClick={() => run((current) => current.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
          >
            表格
          </button>
          <button
            type="button"
            className={`kd-btn min-h-11 px-3 text-sm ${schemeOpen ? "kd-btn-primary" : "kd-btn-secondary"}`}
            aria-pressed={schemeOpen}
            onClick={() => setSchemeOpen((open) => !open)}
          >
            编号样式
          </button>
          <button
            type="button"
            className={`kd-btn min-h-11 px-3 text-sm ${chromeOpen ? "kd-btn-primary" : "kd-btn-secondary"}`}
            aria-pressed={chromeOpen}
            onClick={() => setChromeOpen((open) => !open)}
          >
            页眉页脚
          </button>
          {inTable ? (
            <>
              <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().addRowAfter().run())}>
                加行
              </button>
              <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().addColumnAfter().run())}>
                加列
              </button>
              <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().deleteRow().run())}>
                删行
              </button>
              <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().deleteColumn().run())}>
                删列
              </button>
              <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-3 text-sm" onClick={() => run((current) => current.chain().deleteTable().run())}>
                删表
              </button>
            </>
          ) : null}
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              if (file && editor) {
                insertImage(editor, file)
                  .then(() => setStatus("dirty"))
                  .catch((err) => setError(err instanceof Error ? err.message : "插图失败"))
              }
            }}
          />
        </div>

        {schemeOpen ? (
          <ListSchemePanel
            scheme={listScheme}
            onChange={(next) => {
              setListScheme(sanitizeListScheme(next))
              setStatus("dirty")
            }}
          />
        ) : null}
        {chromeOpen ? (
          <PageChromePanel
            chrome={pageChrome}
            onChange={(next) => {
              setPageChrome(sanitizePageChrome(next))
              setStatus("dirty")
            }}
          />
        ) : null}
        {error ? (
          <p className="px-4 py-2 text-sm" style={{ color: "var(--kd-fire)" }}>
            {error}
          </p>
        ) : null}
        <style>{schemeCss}</style>
        <EditorContent editor={editor} />
        {printOpen ? (
          <PrintPreview
            title={sanitizeTitle(title)}
            content={currentContent()}
            listScheme={listScheme}
            pageChrome={pageChrome}
            onClose={() => setPrintOpen(false)}
          />
        ) : null}
      </div>
    </div>
  )
}
