import { describe, expect, it } from "vitest"
import { contentToHtml, contentToPlainText, documentToStandaloneHtml } from "./html"
import { importTextFile } from "./text"
import { createEmptyDocument } from "./document"

describe("html and text conversion", () => {
  it("exports headings and lists", () => {
    const html = contentToHtml({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "标题" }] },
        {
          type: "orderedList",
          content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "一项" }] }] }],
        },
      ],
    })
    expect(html).toContain("<h2>标题</h2>")
    expect(html).toContain("<ol>")
    expect(html).toContain("<li><p>一项</p></li>")
  })

  it("imports markdown-like text", () => {
    const doc = importTextFile("# 你好\n\n- 甲\n1. 乙", "md")
    expect(doc.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 1 } })
    expect(doc.content?.some((node) => node.type === "bulletList")).toBe(true)
    expect(doc.content?.some((node) => node.type === "orderedList")).toBe(true)
  })

  it("builds a standalone HTML file with chrome", () => {
    const doc = createEmptyDocument()
    doc.title = "讲义"
    doc.pageChrome.headerCenter = "科苗文档"
    const html = documentToStandaloneHtml(doc)
    expect(html).toContain("<title>讲义</title>")
    expect(html).toContain("科苗文档")
    expect(contentToPlainText(doc.content)).toBe("")
  })
})
