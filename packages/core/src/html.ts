import { sanitizeContent } from "./document"
import { chromeSlotText, sanitizePageChrome } from "./page-chrome"
import { listSchemeCss, sanitizeListScheme } from "./list-scheme"
import type { AnyDocNode, DocNode, KemiaoDocument } from "./types"

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function renderInline(nodes?: AnyDocNode[]): string {
  if (!nodes) return ""
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>"
      if (node.type === "text") {
        let html = escapeHtml(node.text || "")
        if (node.marks?.some((mark) => mark.type === "italic")) html = `<em>${html}</em>`
        if (node.marks?.some((mark) => mark.type === "bold")) html = `<strong>${html}</strong>`
        return html
      }
      return renderInline((node as { content?: AnyDocNode[] }).content)
    })
    .join("")
}

function renderBlocks(nodes?: AnyDocNode[]): string {
  if (!nodes) return ""
  return nodes.map(renderNode).join("")
}

function renderNode(node: AnyDocNode): string {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))
    return `<h${level}>${renderInline(node.content) || "&nbsp;"}</h${level}>`
  }
  if (node.type === "paragraph") return `<p>${renderInline(node.content) || "&nbsp;"}</p>`
  if (node.type === "bulletList") {
    return `<ul>${(node.content || []).map((item) => `<li>${renderBlocks(item.content)}</li>`).join("")}</ul>`
  }
  if (node.type === "orderedList") {
    return `<ol>${(node.content || []).map((item) => `<li>${renderBlocks(item.content)}</li>`).join("")}</ol>`
  }
  if (node.type === "image") {
    const src = escapeHtml(String(node.attrs?.src || ""))
    const alt = escapeHtml(String(node.attrs?.alt || ""))
    return src ? `<p><img src="${src}" alt="${alt}"></p>` : ""
  }
  if (node.type === "table") {
    const rows = (node.content || [])
      .map((row) => {
        const cells = (row.content || [])
          .map((cell) => {
            const tag = cell.type === "tableHeader" ? "th" : "td"
            return `<${tag}>${renderBlocks(cell.content)}</${tag}>`
          })
          .join("")
        return `<tr>${cells}</tr>`
      })
      .join("")
    return `<table>${rows}</table>`
  }
  return renderBlocks((node as { content?: AnyDocNode[] }).content)
}

export function contentToHtml(content: unknown): string {
  return renderBlocks(sanitizeContent(content).content) || "<p></p>"
}

export function paginateHtml(html: string): string[] {
  const source = html.trim() || "<p></p>"
  const blocks = source.match(/<h[1-6][\s\S]*?<\/h[1-6]>|<table[\s\S]*?<\/table>|<ul[\s\S]*?<\/ul>|<ol[\s\S]*?<\/ol>|<p[\s\S]*?<\/p>/gi)
  if (!blocks?.length) return [source]
  const pages: string[] = []
  let current = ""
  let score = 0
  for (const block of blocks) {
    const weight = /<h[1-6]/.test(block)
      ? 56
      : /<table/.test(block)
        ? 140
        : /<img/.test(block)
          ? 220
          : /<(ul|ol)/.test(block)
            ? 28 * (block.match(/<li/gi)?.length || 1)
            : 36
    if (current && score + weight > 820) {
      pages.push(current)
      current = block
      score = weight
    } else {
      current += block
      score += weight
    }
  }
  if (current) pages.push(current)
  return pages.length ? pages : [source]
}

export function documentToStandaloneHtml(doc: Pick<KemiaoDocument, "title" | "content" | "listScheme" | "pageChrome">): string {
  const chrome = sanitizePageChrome(doc.pageChrome)
  const css = listSchemeCss(sanitizeListScheme(doc.listScheme))
  const body = contentToHtml(sanitizeContent(doc.content))
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(doc.title)}</title>
<style>
  body { margin: 0; color: #111; font: 16px/1.7 "PingFang SC","Microsoft YaHei",sans-serif; }
  .docs-prose { max-width: 210mm; margin: 0 auto; padding: 16mm 18mm 20mm; }
  .docs-band { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #555; }
  .docs-band span { flex: 1; }
  .docs-band .c { text-align: center; }
  .docs-band .r { text-align: right; }
  @page { size: A4; margin: 14mm 16mm 16mm; }
  @media print {
    .docs-print-header { position: running(docs-header); }
    .docs-print-footer { position: running(docs-footer); }
    @page {
      @top-center { content: element(docs-header); }
      @bottom-center { content: element(docs-footer); }
    }
  }
  ${css}
</style>
</head>
<body>
  <header class="docs-print-header docs-band">
    <span>${escape(chromeSlotText(chrome, "header", "left", 1, 1))}</span>
    <span class="c">${escape(chromeSlotText(chrome, "header", "center", 1, 1))}</span>
    <span class="r">${escape(chromeSlotText(chrome, "header", "right", 1, 1))}</span>
  </header>
  <article class="docs-prose">${body}</article>
  <footer class="docs-print-footer docs-band">
    <span>${escape(chromeSlotText(chrome, "footer", "left", 1, 1))}</span>
    <span class="c">${escape(chromeSlotText(chrome, "footer", "center", 1, 1))}</span>
    <span class="r">${escape(chromeSlotText(chrome, "footer", "right", 1, 1))}</span>
  </footer>
</body>
</html>`
}

export function contentToPlainText(content: unknown): string {
  const walk = (node: AnyDocNode): string => {
    if (node.type === "text") return node.text || ""
    if ("content" in node && node.content) return node.content.map(walk).join("")
    return ""
  }
  return walk(sanitizeContent(content) as AnyDocNode)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function asDocNode(content: DocNode["content"]): DocNode {
  return { type: "doc", content }
}
