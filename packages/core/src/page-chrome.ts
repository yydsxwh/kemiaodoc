import type { PageChrome, PageNumberPosition } from "./types"

export const PAGE_NUMBER_POSITIONS: PageNumberPosition[] = [
  "none",
  "header-left",
  "header-center",
  "header-right",
  "footer-left",
  "footer-center",
  "footer-right",
]

export const PAGE_NUMBER_LABELS: Record<PageNumberPosition, string> = {
  none: "不显示页码",
  "header-left": "页眉左侧",
  "header-center": "页眉中间",
  "header-right": "页眉右侧",
  "footer-left": "页脚左侧",
  "footer-center": "页脚中间",
  "footer-right": "页脚右侧",
}

export const DEFAULT_PAGE_CHROME: PageChrome = {
  headerLeft: "",
  headerCenter: "",
  headerRight: "",
  footerLeft: "",
  footerCenter: "",
  footerRight: "",
  pageNumber: "footer-center",
  startAt: 1,
}

function clipChromeText(value: unknown): string {
  return String(value ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .slice(0, 40)
}

export function sanitizePageChrome(input: unknown): PageChrome {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {}
  const pageNumber = PAGE_NUMBER_POSITIONS.includes(raw.pageNumber as PageNumberPosition)
    ? (raw.pageNumber as PageNumberPosition)
    : DEFAULT_PAGE_CHROME.pageNumber
  const startAt = Number(raw.startAt)
  return {
    headerLeft: clipChromeText(raw.headerLeft),
    headerCenter: clipChromeText(raw.headerCenter),
    headerRight: clipChromeText(raw.headerRight),
    footerLeft: clipChromeText(raw.footerLeft),
    footerCenter: clipChromeText(raw.footerCenter),
    footerRight: clipChromeText(raw.footerRight),
    pageNumber,
    startAt: Number.isFinite(startAt) ? Math.min(9999, Math.max(1, Math.round(startAt))) : 1,
  }
}

export function chromeSlotText(
  chrome: PageChrome,
  band: "header" | "footer",
  align: "left" | "center" | "right",
  page: number,
  total: number,
): string {
  const slot = `${band}-${align}` as PageNumberPosition
  const text =
    band === "header"
      ? align === "left"
        ? chrome.headerLeft
        : align === "center"
          ? chrome.headerCenter
          : chrome.headerRight
      : align === "left"
        ? chrome.footerLeft
        : align === "center"
          ? chrome.footerCenter
          : chrome.footerRight
  if (chrome.pageNumber === slot) {
    return `${chrome.startAt + page - 1} / ${chrome.startAt + total - 1}`
  }
  return text
}
