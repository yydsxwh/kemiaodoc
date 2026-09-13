import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx"
import {
  chromeSlotText,
  sanitizeContent,
  sanitizePageChrome,
  sanitizeTitle,
  type AnyDocNode,
  type KemiaoDocument,
  type PageChrome,
} from "@kemiaodoc/core"

const HEADING_LEVELS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
] as const

function inlineRuns(nodes?: AnyDocNode[]): TextRun[] {
  const runs: TextRun[] = []
  for (const node of nodes || []) {
    if (node.type === "hardBreak") {
      runs.push(new TextRun({ break: 1 }))
      continue
    }
    if (node.type === "text") {
      runs.push(
        new TextRun({
          text: node.text || "",
          bold: node.marks?.some((mark) => mark.type === "bold"),
          italics: node.marks?.some((mark) => mark.type === "italic"),
        }),
      )
    }
  }
  return runs.length ? runs : [new TextRun("")]
}

async function imageParagraph(src: string, alt?: string): Promise<Paragraph | null> {
  try {
    let data: Uint8Array
    let type: "png" | "jpg" | "gif" | "bmp" = "png"
    if (src.startsWith("data:image/")) {
      const match = /^data:image\/(\w+);base64,(.+)$/.exec(src)
      if (!match) return null
      if (match[1] === "jpeg" || match[1] === "jpg") type = "jpg"
      else if (match[1] === "gif") type = "gif"
      else type = "png"
      data = Uint8Array.from(atob(match[2]), (char) => char.charCodeAt(0))
    } else if (/^https?:\/\//i.test(src) && typeof fetch === "function") {
      const response = await fetch(src)
      if (!response.ok) return null
      data = new Uint8Array(await response.arrayBuffer())
      const contentType = response.headers.get("content-type") || ""
      if (contentType.includes("jpeg")) type = "jpg"
      else if (contentType.includes("gif")) type = "gif"
    } else {
      return null
    }
    return new Paragraph({
      children: [
        new ImageRun({
          data,
          transformation: { width: 480, height: 270 },
          type,
          altText: { title: alt || "image", description: alt || "", name: alt || "image" },
        }),
      ],
    })
  } catch {
    return alt ? new Paragraph({ children: [new TextRun(alt)] }) : null
  }
}

async function blocksToDocx(nodes?: AnyDocNode[]): Promise<Array<Paragraph | Table>> {
  const out: Array<Paragraph | Table> = []
  for (const node of nodes || []) {
    if (node.type === "heading") {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))
      out.push(
        new Paragraph({
          heading: HEADING_LEVELS[level - 1],
          children: inlineRuns(node.content),
        }),
      )
      continue
    }
    if (node.type === "paragraph") {
      out.push(new Paragraph({ children: inlineRuns(node.content), spacing: { after: 160 } }))
      continue
    }
    if (node.type === "bulletList" || node.type === "orderedList") {
      for (const item of node.content || []) {
        const text = (item.content || [])
          .flatMap((child) => ("content" in child ? child.content || [] : []))
          .filter((child) => child.type === "text")
          .map((child) => (child.type === "text" ? child.text : ""))
          .join("")
        out.push(
          new Paragraph({
            children: [new TextRun(text)],
            numbering: {
              reference: node.type === "orderedList" ? "docs-numbered" : "docs-bullets",
              level: 0,
            },
          }),
        )
      }
      continue
    }
    if (node.type === "image") {
      const image = await imageParagraph(node.attrs.src, node.attrs.alt)
      if (image) out.push(image)
      continue
    }
    if (node.type === "table") {
      const rows = (node.content || []).map(
        (row) =>
          new TableRow({
            children: (row.content || []).map(
              (cell) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: inlineRuns(
                        (cell.content || []).flatMap((child) =>
                          child.type === "paragraph" || child.type === "heading" ? child.content || [] : [],
                        ),
                      ),
                    }),
                  ],
                  width: { size: 3000, type: WidthType.DXA },
                }),
            ),
          }),
      )
      if (rows.length) {
        out.push(
          new Table({
            rows,
            width: { size: 9000, type: WidthType.DXA },
          }),
        )
      }
    }
  }
  return out.length ? out : [new Paragraph("")]
}

function bandChildren(chrome: PageChrome, band: "header" | "footer", align: "left" | "center" | "right") {
  const slot = `${band}-${align}`
  if (chrome.pageNumber === slot) {
    return [
      new TextRun({ children: [PageNumber.CURRENT] }),
      new TextRun(" / "),
      new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
    ]
  }
  const text = chromeSlotText(chrome, band, align, 1, 1)
  return text ? [new TextRun(text)] : []
}

function makeBand(chrome: PageChrome, band: "header" | "footer") {
  const alignment =
    band === "header"
      ? chrome.pageNumber.startsWith("header-")
        ? chrome.pageNumber
        : chrome.headerCenter
          ? "header-center"
          : chrome.headerRight
            ? "header-right"
            : "header-left"
      : chrome.pageNumber.startsWith("footer-")
        ? chrome.pageNumber
        : chrome.footerCenter
          ? "footer-center"
          : chrome.footerRight
            ? "footer-right"
            : "footer-left"
  const align = alignment.endsWith("left") ? "left" : alignment.endsWith("right") ? "right" : "center"
  const children = [
    ...bandChildren(chrome, band, "left"),
    ...bandChildren(chrome, band, "center"),
    ...bandChildren(chrome, band, "right"),
  ]
  if (!children.length) return undefined
  return new Paragraph({
    alignment:
      align === "left" ? AlignmentType.LEFT : align === "right" ? AlignmentType.RIGHT : AlignmentType.CENTER,
    children:
      bandChildren(chrome, band, align).length > 0
        ? bandChildren(chrome, band, align)
        : [new TextRun(chromeSlotText(chrome, band, align, 1, 1))],
    border: { bottom: band === "header" ? { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } : undefined },
  })
}

export async function exportDocx(doc: Pick<KemiaoDocument, "title" | "content" | "pageChrome">): Promise<Blob> {
  const chrome = sanitizePageChrome(doc.pageChrome)
  const content = sanitizeContent(doc.content)
  const children = await blocksToDocx(content.content)
  const header = makeBand(chrome, "header")
  const footer = makeBand(chrome, "footer")

  const document = new Document({
    title: sanitizeTitle(doc.title),
    numbering: {
      config: [
        {
          reference: "docs-numbered",
          levels: [{ level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT }],
        },
        {
          reference: "docs-bullets",
          levels: [{ level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT }],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            pageNumbers: { start: chrome.startAt },
          },
        },
        headers: header ? { default: new Header({ children: [header] }) } : undefined,
        footers: footer ? { default: new Footer({ children: [footer] }) } : undefined,
        children,
      },
    ],
  })

  return Packer.toBlob(document)
}
