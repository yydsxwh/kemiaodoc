import { emptyDoc, sanitizeContent } from "./document"
import type { BlockChild, DocNode, ParagraphNode } from "./types"

type OpenList = { type: "bulletList" | "orderedList"; items: Array<{ type: "listItem"; content: ParagraphNode[] }> }

export function parsePlainBlocks(text: string): BlockChild[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const blocks: BlockChild[] = []
  let list: OpenList | null = null

  const flush = () => {
    if (list) {
      blocks.push({ type: list.type, content: list.items })
      list = null
    }
  }

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2].trim() }],
      })
      continue
    }
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(line)
    if (bullet) {
      if (list?.type !== "bulletList") {
        flush()
        list = { type: "bulletList", items: [] }
      }
      list.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: bullet[1] }] }],
      })
      continue
    }
    const ordered = /^\s*\d+[.)、]\s+(.+)$/.exec(line)
    if (ordered) {
      if (list?.type !== "orderedList") {
        flush()
        list = { type: "orderedList", items: [] }
      }
      list.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: ordered[1] }] }],
      })
      continue
    }
    flush()
    if (line.trim()) {
      blocks.push({ type: "paragraph", content: [{ type: "text", text: line.trim() }] })
    }
  }
  flush()
  return blocks.length ? blocks : [{ type: "paragraph" }]
}

function stripHtmlToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(withoutScripts)?.[1] || withoutScripts
  return body
    .replace(/<\/(p|div|h[1-6]|li|tr|table|ul|ol)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<h([1-6])[^>]*>/gi, (_, level: string) => `${"#".repeat(Number(level))} `)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
}

function parseTxt(text: string): BlockChild[] {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split("\n")
      return {
        type: "paragraph" as const,
        content: lines.flatMap((line, index) => {
          const nodes: ParagraphNode["content"] = [{ type: "text", text: line }]
          if (index < lines.length - 1) nodes.push({ type: "hardBreak" })
          return nodes
        }),
      }
    })
  return paragraphs.length ? paragraphs : [{ type: "paragraph" }]
}

export function importTextFile(source: string, kind: "html" | "md" | "txt"): DocNode {
  const content =
    kind === "html"
      ? parsePlainBlocks(stripHtmlToText(source))
      : kind === "md"
        ? parsePlainBlocks(source)
        : parseTxt(source)
  return sanitizeContent({ type: "doc", content }) || emptyDoc()
}

export function detectTextKind(fileName: string): "html" | "md" | "txt" {
  const name = fileName.toLowerCase()
  if (/\.html?$/.test(name)) return "html"
  if (/\.md$/.test(name)) return "md"
  return "txt"
}
