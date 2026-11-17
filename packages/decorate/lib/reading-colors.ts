/**
 * 浅色阅读区的文字语义。
 * 品牌填充色可以很亮，不适合直接当小字颜色；这里另给正文、说明和链接。
 * 深色主题仍用配色自己的浅字，并垫深色衬底，避免白底衬板把浅字冲掉。
 */

import { colorSchemeFor } from "./product-appearance";
import type { ThemePaletteTokens } from "./site-theme-palettes";

export const LIGHT_READING_COLORS = {
  body: "#1e293b",
  subtle: "#475569",
  link: "#075985",
  panel: "rgba(255, 255, 255, 0.94)",
  card: "rgba(255, 255, 255, 0.96)",
} as const;

export function readingColorVars(tokens: Pick<ThemePaletteTokens, "bg" | "ink" | "muted" | "brand">): Record<string, string> {
  if (colorSchemeFor(tokens.bg) === "dark") {
    return {
      "--text-body": tokens.ink,
      "--text-subtle": tokens.muted,
      "--text-link": tokens.brand,
      "--reading-bg": "rgba(15, 23, 42, 0.92)",
      "--reading-bg-strong": "rgba(15, 23, 42, 0.96)",
    };
  }
  return {
    "--text-body": LIGHT_READING_COLORS.body,
    "--text-subtle": LIGHT_READING_COLORS.subtle,
    "--text-link": LIGHT_READING_COLORS.link,
    "--reading-bg": LIGHT_READING_COLORS.panel,
    "--reading-bg-strong": LIGHT_READING_COLORS.card,
  };
}

function channel(hex: string) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((item) => item + item).join("") : value.slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16) / 255,
    Number.parseInt(full.slice(2, 4), 16) / 255,
    Number.parseInt(full.slice(4, 6), 16) / 255,
  ];
}

function luminance(hex: string) {
  const linear = channel(hex).map((item) => (
    item <= 0.04045 ? item / 12.92 : ((item + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

/** 只比较不透明十六进制。半透明衬底要另外按叠在照片上的结果人工看。 */
export function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
