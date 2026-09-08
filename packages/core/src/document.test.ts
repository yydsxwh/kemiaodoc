import { describe, expect, it } from "vitest"
import { sanitizeContent, sanitizeDocument } from "./document"

describe("document sanitize", () => {
  it("drops unknown nodes and script-like images", () => {
    const doc = sanitizeContent({
      type: "doc",
      content: [
        { type: "script", content: [{ type: "text", text: "alert(1)" }] },
        { type: "paragraph", content: [{ type: "text", text: "hello", marks: [{ type: "bold" }, { type: "link" }] }] },
        { type: "image", attrs: { src: "javascript:alert(1)" } },
        { type: "image", attrs: { src: "https://example.com/a.png", alt: "图" } },
      ],
    })
    expect(doc.content).toHaveLength(2)
    expect(doc.content?.[0]).toMatchObject({
      type: "paragraph",
      content: [{ type: "text", text: "hello", marks: [{ type: "bold" }] }],
    })
    expect(doc.content?.[1]).toMatchObject({
      type: "image",
      attrs: { src: "https://example.com/a.png", alt: "图" },
    })
  })

  it("fills an empty document with defaults", () => {
    const doc = sanitizeDocument({})
    expect(doc.title).toBe("未命名文档")
    expect(doc.content.type).toBe("doc")
    expect(doc.listScheme.presetId).toBe("standard")
    expect(doc.pageChrome.pageNumber).toBe("footer-center")
  })
})
