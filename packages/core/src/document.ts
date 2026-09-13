import { sanitizeListScheme, STANDARD_LIST_SCHEME } from "./list-scheme"
import { DEFAULT_PAGE_CHROME, sanitizePageChrome } from "./page-chrome"
import type {
  AnyDocNode,
  BlockChild,
  DocNode,
  ImageNode,
  KemiaoDocument,
  TextMark,
} from "./types"
import { LOCAL_DOC_ID } from "./types"

const ALLOWED_TYPES = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "hardBreak",
  "bulletList",
  "orderedList",
  "listItem",
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
])

const ALLOWED_MARKS = new Set(["bold", "italic"])

export function emptyDoc(): DocNode {
  return { type: "doc", content: [{ type: "paragraph" }] }
}

export function untitledTitle(): string {
  return "未命名文档"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function sanitizeMarks(marks: unknown): TextMark[] | undefined {
  if (!Array.isArray(marks)) return undefined
  const next = marks
    .filter((item) => isRecord(item) && ALLOWED_MARKS.has(String(item.type)))
    .map((item) => ({ type: String((item as { type: string }).type) as TextMark["type"] }))
  return next.length ? next : undefined
}

function sanitizeImageAttrs(attrs: unknown): ImageNode["attrs"] | undefined {
  if (!isRecord(attrs)) return undefined
  const src = String(attrs.src || "").trim()
  if (src && /^(https?:\/\/|data:image\/|\/uploads\/|\/)/i.test(src)) {
    return { src, alt: String(attrs.alt || "").slice(0, 120) }
  }
  return undefined
}

function sanitizeCellAttrs(attrs: unknown): { colspan?: number; rowspan?: number } | undefined {
  if (!isRecord(attrs)) return undefined
  const colspan = Number(attrs.colspan)
  const rowspan = Number(attrs.rowspan)
  const next: { colspan?: number; rowspan?: number } = {}
  if (Number.isFinite(colspan) && colspan > 1) next.colspan = Math.min(12, Math.round(colspan))
  if (Number.isFinite(rowspan) && rowspan > 1) next.rowspan = Math.min(20, Math.round(rowspan))
  return Object.keys(next).length ? next : undefined
}

export function sanitizeContent(input: unknown): DocNode {
  const walk = (node: unknown, depth: number): AnyDocNode | null => {
    if (depth > 40 || !isRecord(node)) return null
    const type = String(node.type || "")
    if (!ALLOWED_TYPES.has(type)) return null

    if (type === "text") {
      const text = String(node.text || "").slice(0, 20_000)
      return text ? { type: "text", text, marks: sanitizeMarks(node.marks) } : null
    }
    if (type === "hardBreak") return { type: "hardBreak" }
    if (type === "image") {
      const attrs = sanitizeImageAttrs(node.attrs)
      return attrs ? { type: "image", attrs } : null
    }

    const children = Array.isArray(node.content)
      ? node.content.map((child) => walk(child, depth + 1)).filter((child): child is AnyDocNode => Boolean(child))
      : []

    if (type === "heading") {
      const level = Number(isRecord(node.attrs) ? node.attrs.level : 2)
      return {
        type: "heading",
        attrs: {
          level: Number.isFinite(level) ? Math.min(6, Math.max(1, Math.round(level))) : 2,
        },
        content: (children.length ? children : [{ type: "text", text: "" }]) as never,
      }
    }
    if (type === "tableCell" || type === "tableHeader") {
      return {
        type,
        attrs: sanitizeCellAttrs(node.attrs),
        content: (children.length ? children : [{ type: "paragraph" }]) as BlockChild[],
      }
    }
    if (type === "tableRow") {
      return {
        type,
        content: (children.length ? children : [{ type: "tableCell", content: [{ type: "paragraph" }] }]) as never,
      }
    }
    if (type === "table") {
      return {
        type,
        content: (children.length
          ? children
          : [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }]) as never,
      }
    }
    if (type === "listItem") {
      return { type, content: (children.length ? children : [{ type: "paragraph" }]) as BlockChild[] }
    }
    if (type === "bulletList" || type === "orderedList") {
      return {
        type,
        content: (children.length ? children : [{ type: "listItem", content: [{ type: "paragraph" }] }]) as never,
      }
    }
    if (type === "doc") {
      return { type: "doc", content: (children.length ? children : [{ type: "paragraph" }]) as BlockChild[] }
    }
    return { type: "paragraph", content: children as never }
  }

  return (walk(input, 0) as DocNode | null) || emptyDoc()
}

export function sanitizeTitle(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 80) || untitledTitle()
}

export function createEmptyDocument(id = LOCAL_DOC_ID): KemiaoDocument {
  const now = new Date().toISOString()
  return {
    id,
    title: untitledTitle(),
    content: emptyDoc(),
    listScheme: STANDARD_LIST_SCHEME,
    pageChrome: DEFAULT_PAGE_CHROME,
    createdAt: now,
    updatedAt: now,
  }
}

export function sanitizeDocument(input: unknown, fallbackId = LOCAL_DOC_ID): KemiaoDocument {
  const raw = isRecord(input) ? input : {}
  const now = new Date().toISOString()
  return {
    id: String(raw.id || fallbackId),
    title: sanitizeTitle(raw.title),
    content: sanitizeContent(raw.content),
    listScheme: sanitizeListScheme(raw.listScheme),
    pageChrome: sanitizePageChrome(raw.pageChrome),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : now,
  }
}

export function downloadFileName(title: string, ext: string): string {
  const safe = title.replace(/[\\/:*?"<>|]+/g, "_").trim() || "文档"
  return `${safe.slice(0, 60)}.${ext}`
}
