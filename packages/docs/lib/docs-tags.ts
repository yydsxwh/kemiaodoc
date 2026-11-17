/**
 * 标签展示名可以改，key 一旦生成就固定，避免改名拆掉文档关联。
 */

export const DOCS_TAG_NAME_MAX = 24;
export const DOCS_TAGS_PER_DOCUMENT = 12;

export function normalizeTagName(raw: unknown): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, DOCS_TAG_NAME_MAX);
}

export function tagKeyFromName(name: string): string {
  const folded = name.normalize("NFKC").toLowerCase();
  const key = folded
    .replace(/\s+/g, "-")
    .replace(/[^0-9a-z\u3400-\u9fff-]+/gi, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return key || "tag";
}

export function uniqueTagNames(raw: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const item of raw) {
    const name = normalizeTagName(item);
    if (!name) continue;
    const key = tagKeyFromName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= DOCS_TAGS_PER_DOCUMENT) break;
  }
  return names;
}
