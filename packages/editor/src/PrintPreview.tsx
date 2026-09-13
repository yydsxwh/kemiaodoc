import { useEffect, useMemo, useState } from "react"
import {
  chromeSlotText,
  contentToHtml,
  listSchemeCss,
  paginateHtml,
  sanitizePageChrome,
  type DocNode,
  type ListScheme,
  type PageChrome,
} from "@kemiaodoc/core"

export function PrintPreview({
  title,
  content,
  listScheme,
  pageChrome,
  onClose,
}: {
  title: string
  content: DocNode
  listScheme: ListScheme
  pageChrome: PageChrome
  onClose: () => void
}) {
  const chrome = sanitizePageChrome(pageChrome)
  const css = useMemo(() => listSchemeCss(listScheme), [listScheme])
  const pages = useMemo(() => paginateHtml(contentToHtml(content)), [content])
  const [wechat, setWechat] = useState(false)

  useEffect(() => {
    setWechat(/MicroMessenger/i.test(navigator.userAgent))
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  return (
    <div
      className="docs-print-root fixed inset-0 z-[80] overflow-auto bg-black/40 px-3 py-4 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-print-title"
    >
      <div className="docs-print-toolbar mx-auto mb-3 flex max-w-3xl flex-wrap items-center gap-2 rounded-2xl bg-white p-3">
        <h2 id="docs-print-title" className="mr-auto text-sm font-medium">
          打印预览 · {title}
        </h2>
        <button type="button" className="kd-btn kd-btn-primary min-h-11 px-4 text-sm" onClick={() => window.print()}>
          打印
        </button>
        <button type="button" className="kd-btn kd-btn-secondary min-h-11 px-4 text-sm" onClick={onClose}>
          关闭
        </button>
        {wechat ? (
          <p className="w-full text-xs leading-5" style={{ color: "var(--kd-muted)" }}>
            微信里常常调不起系统打印。可先看预览，或另存为 HTML / Word 后用系统浏览器打开再印。
          </p>
        ) : null}
      </div>
      <style>{css}</style>
      <div className="docs-print-sheets mx-auto flex max-w-3xl flex-col gap-4 pb-10">
        {pages.map((page, index) => (
          <section key={index} className="docs-print-page">
            <div className="docs-print-band">
              <span>{chromeSlotText(chrome, "header", "left", index + 1, pages.length)}</span>
              <span className="c">{chromeSlotText(chrome, "header", "center", index + 1, pages.length)}</span>
              <span className="r">{chromeSlotText(chrome, "header", "right", index + 1, pages.length)}</span>
            </div>
            <div className="docs-prose docs-print-body" dangerouslySetInnerHTML={{ __html: page }} />
            <div className="docs-print-band docs-print-footer">
              <span>{chromeSlotText(chrome, "footer", "left", index + 1, pages.length)}</span>
              <span className="c">{chromeSlotText(chrome, "footer", "center", index + 1, pages.length)}</span>
              <span className="r">{chromeSlotText(chrome, "footer", "right", index + 1, pages.length)}</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
