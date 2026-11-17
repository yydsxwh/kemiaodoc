/**
 * 搜索摘要用纯文本切片，不把关键词拼进 HTML。
 */

export const DOCS_SEARCH_QUERY_MAX = 80;
export const DOCS_SEARCH_PAGE_SIZE = 20;
export const DOCS_PLAIN_TEXT_MAX = 100_000;

export type DocsSearchRange = { start: number; end: number };

export type DocsSearchSnippet = {
  text: string;
  ranges: DocsSearchRange[];
};

export function normalizeSearchQuery(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, DOCS_SEARCH_QUERY_MAX);
}

export function clampPlainText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, DOCS_PLAIN_TEXT_MAX);
}

export function buildSearchSnippet(source: string, query: string, radius = 36): DocsSearchSnippet | null {
  const text = source.replace(/\s+/g, " ").trim();
  const needle = query.trim();
  if (!text || !needle) return null;
  const haystack = text.toLowerCase();
  const at = haystack.indexOf(needle.toLowerCase());
  if (at < 0) return null;
  const start = Math.max(0, at - radius);
  const end = Math.min(text.length, at + needle.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const slice = text.slice(start, end);
  const textOut = `${prefix}${slice}${suffix}`;
  const rangeStart = prefix.length + (at - start);
  return {
    text: textOut,
    ranges: [{ start: rangeStart, end: rangeStart + needle.length }],
  };
}

export function snippetMatchesQuery(snippet: DocsSearchSnippet, query: string): boolean {
  return snippet.ranges.every((range) => {
    const piece = snippet.text.slice(range.start, range.end);
    return piece.toLowerCase() === query.trim().toLowerCase();
  });
}
