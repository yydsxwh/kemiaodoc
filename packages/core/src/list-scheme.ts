import type { BulletStyle, ListLevel, ListScheme, NumberStyle } from "./types"

export const NUMBER_STYLES: NumberStyle[] = [
  "decimal",
  "cjk",
  "lower-alpha",
  "upper-alpha",
  "lower-roman",
  "upper-roman",
  "circled",
]

export const BULLET_STYLES: BulletStyle[] = ["disc", "circle", "square", "dash"]

export const NUMBER_STYLE_LABELS: Record<NumberStyle, string> = {
  decimal: "1 2 3",
  cjk: "一 二 三",
  "lower-alpha": "a b c",
  "upper-alpha": "A B C",
  "lower-roman": "i ii iii",
  "upper-roman": "I II III",
  circled: "① ② ③",
}

export const BULLET_STYLE_LABELS: Record<BulletStyle, string> = {
  disc: "实心圆 •",
  circle: "空心圆 ○",
  square: "方块 ■",
  dash: "短横 –",
}

const CJK_DIGITS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
const ROMAN: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
]

export function defaultLevel(index: number): ListLevel {
  return index === 0
    ? { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." }
    : { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." }
}

export function padLevels(levels: ListLevel[]): ListLevel[] {
  const next = levels.slice(0, 6)
  while (next.length < 6) next.push(defaultLevel(next.length))
  return next
}

function clipAffix(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 8)
}

export const STANDARD_LIST_SCHEME: ListScheme = {
  presetId: "standard",
  bullet: "disc",
  levels: Array.from({ length: 6 }, (_, index) => defaultLevel(index)),
}

export type ListSchemePreset = {
  id: string
  label: string
  hint: string
  scheme: ListScheme
}

export const LIST_SCHEME_PRESETS: ListSchemePreset[] = [
  {
    id: "standard",
    label: "标准 1. / 1.1.",
    hint: "论文、讲义常用",
    scheme: STANDARD_LIST_SCHEME,
  },
  {
    id: "chinese",
    label: "中文 一、（一）1.",
    hint: "规章、通知",
    scheme: {
      presetId: "chinese",
      bullet: "disc",
      levels: padLevels([
        { style: "cjk", prefix: "", suffix: "、", includeParents: false, parentSeparator: "." },
        { style: "cjk", prefix: "（", suffix: "）", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
        { style: "lower-alpha", prefix: "", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "lower-roman", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
      ]),
    },
  },
  {
    id: "chapter",
    label: "章节 第1章 / 第1节",
    hint: "教材目录",
    scheme: {
      presetId: "chapter",
      bullet: "disc",
      levels: padLevels([
        { style: "decimal", prefix: "第", suffix: "章", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "第", suffix: "节", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." },
        { style: "lower-alpha", prefix: "", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
      ]),
    },
  },
  {
    id: "paren",
    label: "括号 (1) (a) (i)",
    hint: "英文材料",
    scheme: {
      presetId: "paren",
      bullet: "circle",
      levels: padLevels([
        { style: "decimal", prefix: "(", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "lower-alpha", prefix: "(", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "lower-roman", prefix: "(", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: true, parentSeparator: "." },
        { style: "lower-alpha", prefix: "", suffix: ")", includeParents: false, parentSeparator: "." },
        { style: "decimal", prefix: "", suffix: ".", includeParents: false, parentSeparator: "." },
      ]),
    },
  },
]

export function sanitizeListScheme(input: unknown): ListScheme {
  if (input == null || (typeof input === "object" && !Array.isArray(input) && Object.keys(input as object).length === 0)) {
    return structuredClone(STANDARD_LIST_SCHEME)
  }
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const preset = LIST_SCHEME_PRESETS.find((item) => item.id === raw.presetId)
  const levels = padLevels(
    (Array.isArray(raw.levels) ? raw.levels : []).map((item, index) => {
      const level = item && typeof item === "object" ? (item as Record<string, unknown>) : {}
      const fallback = defaultLevel(index)
      const style = NUMBER_STYLES.includes(level.style as NumberStyle)
        ? (level.style as NumberStyle)
        : fallback.style
      return {
        style,
        prefix: clipAffix(level.prefix ?? fallback.prefix),
        suffix: clipAffix(level.suffix ?? fallback.suffix),
        includeParents: Boolean(
          level.includeParents === undefined ? fallback.includeParents : level.includeParents,
        ),
        parentSeparator: clipAffix(level.parentSeparator ?? fallback.parentSeparator) || ".",
      }
    }),
  )
  return {
    presetId: preset?.id || "custom",
    bullet: BULLET_STYLES.includes(raw.bullet as BulletStyle) ? (raw.bullet as BulletStyle) : "disc",
    levels,
  }
}

export function presetScheme(id: string): ListScheme {
  const preset = LIST_SCHEME_PRESETS.find((item) => item.id === id)
  return structuredClone(preset ? preset.scheme : STANDARD_LIST_SCHEME)
}

function toAlpha(value: number, upper: boolean): string {
  if (value <= 0) return String(value)
  let remaining = value
  let out = ""
  while (remaining > 0) {
    remaining -= 1
    out = String.fromCharCode((upper ? 65 : 97) + (remaining % 26)) + out
    remaining = Math.floor(remaining / 26)
  }
  return out
}

function toRoman(value: number): string {
  if (value <= 0) return String(value)
  let remaining = Math.min(value, 3999)
  let out = ""
  for (const [amount, glyph] of ROMAN) {
    while (remaining >= amount) {
      out += glyph
      remaining -= amount
    }
  }
  return out
}

export function formatNumber(value: number, style: NumberStyle): string {
  if (style === "decimal") return String(value)
  if (style === "cjk") {
    if (value <= 0) return String(value)
    if (value < 10) return CJK_DIGITS[value]
    if (value === 10) return "十"
    if (value < 20) return `十${CJK_DIGITS[value - 10]}`
    if (value < 100) {
      const tens = Math.floor(value / 10)
      const ones = value % 10
      return `${CJK_DIGITS[tens]}十${ones ? CJK_DIGITS[ones] : ""}`
    }
    return String(value)
  }
  if (style === "lower-alpha") return toAlpha(value, false)
  if (style === "upper-alpha") return toAlpha(value, true)
  if (style === "lower-roman") return toRoman(value).toLowerCase()
  if (style === "upper-roman") return toRoman(value)
  if (value >= 1 && value <= 20) return CIRCLED[value - 1]
  return `(${value})`
}

export function formatListLabel(scheme: ListScheme, path: number[]): string {
  const depth = path.length - 1
  if (depth < 0 || depth >= scheme.levels.length) return ""
  const level = scheme.levels[depth]
  if (level.includeParents) {
    const body = path
      .map((value, index) => formatNumber(value, scheme.levels[index].style))
      .join(level.parentSeparator)
    return `${level.prefix}${body}${level.suffix}`
  }
  return `${level.prefix}${formatNumber(path[depth], level.style)}${level.suffix}`
}

function cssString(value: string): string {
  return JSON.stringify(value)
}

function cssCounterStyle(style: NumberStyle): string {
  if (style === "cjk") return "cjk-ideographic"
  if (style === "circled") return "docs-circled"
  return style
}

export function listSchemeCss(input: unknown): string {
  const scheme = sanitizeListScheme(input)
  const rules = [
    `@counter-style docs-circled { system: cyclic; symbols: ${[...CIRCLED].map((item) => `"${item}"`).join(" ")}; suffix: ""; }`,
    ".docs-prose ol { list-style: none; padding-left: 2.6em; }",
    ".docs-prose ul { list-style: none; padding-left: 1.6em; }",
    ".docs-prose ol > li, .docs-prose ul > li { position: relative; }",
  ]

  for (let depth = 1; depth <= 6; depth += 1) {
    const level = scheme.levels[depth - 1]
    const selector = `.docs-prose ${"ol ".repeat(depth)}`.trimEnd()
    const counter = `docs-l${depth}`
    rules.push(`${selector} { counter-reset: ${counter}; }`)
    rules.push(`${selector} > li { counter-increment: ${counter}; }`)
    const parts: string[] = []
    if (level.prefix) parts.push(cssString(level.prefix))
    if (level.includeParents) {
      for (let parent = 1; parent <= depth; parent += 1) {
        parts.push(`counter(docs-l${parent}, ${cssCounterStyle(scheme.levels[parent - 1].style)})`)
        if (parent < depth) parts.push(cssString(level.parentSeparator))
      }
    } else {
      parts.push(`counter(${counter}, ${cssCounterStyle(level.style)})`)
    }
    if (level.suffix) parts.push(cssString(level.suffix))
    parts.push('"\\00a0"')
    rules.push(
      `${selector} > li::before { content: ${parts.join(" ")}; position: absolute; right: calc(100% + 0.15em); top: 0.15em; white-space: nowrap; font-variant-numeric: tabular-nums; }`,
    )
  }

  const bullet =
    scheme.bullet === "circle" ? "○" : scheme.bullet === "square" ? "■" : scheme.bullet === "dash" ? "–" : "•"
  rules.push(
    `.docs-prose ul > li::before { content: ${cssString(`${bullet}\xa0`)}; position: absolute; right: calc(100% + 0.15em); top: 0.15em; }`,
  )
  return rules.join("\n")
}
