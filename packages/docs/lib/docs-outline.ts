/**
 * 标题身份和本篇目录。
 * 已写入正文的 anchorId 不随改名、移动或在前面插入章节而改变。
 * 旧文档缺 id 时按文档 id + 标题序号做幂等补齐，查看页面不写库。
 * 这里不用 Node 的 crypto，阅读页和编辑器都会引用这份逻辑。
 */

import type { DocsJsonNode } from "@andyyyds/docs/lib/docs-content";

export const HEADING_ANCHOR_PATTERN = /^h_[a-z0-9]{8,32}$/;
export const DOCS_OUTLINE_LEVELS = [1, 2, 3, 4, 5, 6] as const;
export const DOCS_OUTLINE_DEFAULT_MAX_LEVEL = 3;

export type DocsOutlineItem = {
  anchorId: string;
  level: number;
  text: string;
  empty: boolean;
};

export function isHeadingAnchorId(value: unknown): value is string {
  return typeof value === "string" && HEADING_ANCHOR_PATTERN.test(value);
}

export function createHeadingAnchorId(): string {
  const bytes = new Uint8Array(6);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return `h_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function deterministicHeadingAnchorId(docId: string, ordinal: number, salt: number): string {
  let left = 0x811c9dc5;
  let right = 0x811c9dc5 ^ 0x9e3779b9;
  const input = `docs-heading-v1\n${docId}\n${ordinal}\n${salt}`;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x01000193);
  }
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `h_${hex(left)}${hex(right).slice(0, 4)}`;
}

function cloneNode(node: DocsJsonNode): DocsJsonNode {
  return {
    type: node.type,
    attrs: node.attrs ? { ...node.attrs } : undefined,
    text: node.text,
    marks: node.marks?.map((mark) => ({
      type: mark.type,
      attrs: mark.attrs ? { ...mark.attrs } : undefined,
    })),
    content: node.content?.map(cloneNode),
  };
}

function headingText(node: DocsJsonNode): string {
  const parts: string[] = [];
  const walk = (current: DocsJsonNode) => {
    if (current.type === "text") parts.push(current.text || "");
    current.content?.forEach(walk);
  };
  node.content?.forEach(walk);
  return parts.join("").replace(/\s+/g, " ").trim();
}

export function assignHeadingAnchors(
  content: DocsJsonNode,
  docId: string,
): { content: DocsJsonNode; changed: boolean } {
  const next = cloneNode(content);
  const used = new Set<string>();
  let ordinal = 0;
  let changed = false;

  const visit = (node: DocsJsonNode) => {
    if (node.type === "heading") {
      const existing = node.attrs?.anchorId;
      if (isHeadingAnchorId(existing) && !used.has(existing)) {
        used.add(existing);
      } else {
        let salt = 0;
        let anchorId = "";
        do {
          anchorId = deterministicHeadingAnchorId(docId, ordinal, salt);
          salt += 1;
        } while (used.has(anchorId) && salt < 12);
        used.add(anchorId);
        node.attrs = { ...(node.attrs || {}), anchorId };
        changed = true;
      }
      ordinal += 1;
    }
    node.content?.forEach(visit);
  };

  visit(next);
  return { content: next, changed };
}

export function extractOutline(content: DocsJsonNode, docId: string): DocsOutlineItem[] {
  const anchored = assignHeadingAnchors(content, docId).content;
  const items: DocsOutlineItem[] = [];
  const visit = (node: DocsJsonNode) => {
    if (node.type === "heading") {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
      const text = headingText(node);
      const anchorId = String(node.attrs?.anchorId || "");
      if (isHeadingAnchorId(anchorId)) {
        items.push({
          anchorId,
          level,
          text,
          empty: text.length === 0,
        });
      }
    }
    node.content?.forEach(visit);
  };
  visit(anchored);
  return items;
}

export function outlineHasAnchor(items: DocsOutlineItem[], anchorId: string): boolean {
  return items.some((item) => item.anchorId === anchorId);
}

/** 折叠后仍可见的目录项。折叠一个标题会藏起它后面更深的子孙，直到同级或更高级。 */
export function visibleOutlineItems(
  items: DocsOutlineItem[],
  collapsed: ReadonlySet<string>,
  maxLevel: number,
): DocsOutlineItem[] {
  const cap = Math.min(6, Math.max(1, maxLevel));
  const visible: DocsOutlineItem[] = [];
  let hidingAbove: number | null = null;
  for (const item of items) {
    if (hidingAbove !== null) {
      if (item.level > hidingAbove) continue;
      hidingAbove = null;
    }
    if (item.level > cap) continue;
    visible.push(item);
    if (collapsed.has(item.anchorId)) hidingAbove = item.level;
  }
  return visible;
}

export function activeOutlineAnchor(
  positions: { anchorId: string; top: number }[],
  activationLine: number,
  nearBottom: boolean,
): string | null {
  if (!positions.length) return null;
  if (nearBottom) return positions[positions.length - 1]?.anchorId || null;
  let active = positions[0]?.anchorId || null;
  for (const item of positions) {
    if (item.top <= activationLine) active = item.anchorId;
  }
  return active;
}
