import { describe, expect, it } from "vitest"
import {
  formatListLabel,
  formatNumber,
  listSchemeCss,
  presetScheme,
  sanitizeListScheme,
} from "./list-scheme"

describe("list numbering", () => {
  it("formats decimal, cjk, roman and circled numbers", () => {
    expect(formatNumber(3, "decimal")).toBe("3")
    expect(formatNumber(12, "cjk")).toBe("十二")
    expect(formatNumber(4, "lower-roman")).toBe("iv")
    expect(formatNumber(2, "circled")).toBe("②")
    expect(formatNumber(27, "lower-alpha")).toBe("aa")
  })

  it("builds standard and chinese labels", () => {
    const standard = presetScheme("standard")
    expect(formatListLabel(standard, [1])).toBe("1.")
    expect(formatListLabel(standard, [1, 2])).toBe("1.2.")

    const chinese = presetScheme("chinese")
    expect(formatListLabel(chinese, [1])).toBe("一、")
    expect(formatListLabel(chinese, [1, 2])).toBe("（二）")
  })

  it("sanitizes unknown styles and emits CSS counters", () => {
    const scheme = sanitizeListScheme({
      presetId: "nope",
      bullet: "star",
      levels: [{ style: "zzz", prefix: "第", suffix: "节", includeParents: true }],
    })
    expect(scheme.presetId).toBe("custom")
    expect(scheme.bullet).toBe("disc")
    expect(scheme.levels).toHaveLength(6)
    expect(listSchemeCss(scheme)).toContain("counter-reset: docs-l1")
    expect(listSchemeCss(scheme)).toContain("@counter-style docs-circled")
  })
})
