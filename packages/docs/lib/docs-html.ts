/**
 * 文档 JSON ↔ HTML / 纯文本。打开本地文件、另存、打印预览都走这里。
 * 不引入 Prisma。
 */

import {
  emptyDocsContent,
  extractPlainText,
  sanitizeDocsContent,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderMarks(text: string, marks?: DocsJsonNode["marks"]): string {
  let html = escapeHtml(text);
  if (!marks) return html;
  if (marks.some((mark) => mark.type === "italic")) html = `<em>${html}</em>`;
  if (marks.some((mark) => mark.type === "bold")) html = `<strong>${html}</strong>`;
  return html;
}

function renderInline(nodes?: DocsJsonNode[]): string {
  if (!nodes) return "";
  return nodes
    .map((node) => {
      if (node.type === "hardBreak") return "<br>";
      if (node.type === "text") return renderMarks(node.text || "", node.marks);
      return renderInline(node.content);
    })
    .join("");
}

function renderBlocks(nodes?: DocsJsonNode[]): string {
  if (!nodes) return "";
  return nodes.map(renderBlock).join("");
}

function headingAnchorAttr(node: DocsJsonNode): string {
  const anchorId = String(node.attrs?.anchorId || "");
  if (!/^h_[a-z0-9]{8,32}$/.test(anchorId)) return "";
  return ` id="${escapeHtml(anchorId)}" data-anchor-id="${escapeHtml(anchorId)}"`;
}

function renderBlock(node: DocsJsonNode): string {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
    return `<h${level}${headingAnchorAttr(node)}>${renderInline(node.content) || "&nbsp;"}</h${level}>`;
  }
  if (node.type === "paragraph") {
    return `<p>${renderInline(node.content) || "&nbsp;"}</p>`;
  }
  if (node.type === "bulletList") {
    return `<ul>${(node.content || [])
      .map((item) => `<li>${renderBlocks(item.content)}</li>`)
      .join("")}</ul>`;
  }
  if (node.type === "orderedList") {
    return `<ol>${(node.content || [])
      .map((item) => `<li>${renderBlocks(item.content)}</li>`)
      .join("")}</ol>`;
  }
  if (node.type === "image") {
    const src = escapeHtml(String(node.attrs?.src || ""));
    const alt = escapeHtml(String(node.attrs?.alt || ""));
    if (!src) return "";
    const width = Number(node.attrs?.width);
    const height = Number(node.attrs?.height);
    const size =
      Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
        ? ` width="${Math.round(width)}" height="${Math.round(height)}"`
        : "";
    return `<p><img src="${src}" alt="${alt}"${size}></p>`;
  }
  if (node.type === "table") {
    const rows = (node.content || [])
      .map((row) => {
        const cells = (row.content || [])
          .map((cell) => {
            const tag = cell.type === "tableHeader" ? "th" : "td";
            return `<${tag}>${renderBlocks(cell.content)}</${tag}>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    return `<table>${rows}</table>`;
  }
  return renderBlocks(node.content);
}

export function docsContentToHtml(content: DocsJsonNode): string {
  const clean = sanitizeDocsContent(content);
  return renderBlocks(clean.content) || "<p></p>";
}

export function docsContentToPlainText(content: DocsJsonNode): string {
  return extractPlainText(sanitizeDocsContent(content)).replace(/\n{3,}/g, "\n\n").trim();
}

function textToParagraphs(text: string): DocsJsonNode[] {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const nodes = blocks
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      type: "paragraph" as const,
      content: block.split("\n").flatMap((line, index) => {
        const piece: DocsJsonNode[] = [{ type: "text", text: line }];
        if (index < block.split("\n").length - 1) piece.push({ type: "hardBreak" });
        return piece;
      }),
    }));
  return nodes.length ? nodes : [{ type: "paragraph" }];
}

function markdownToNodes(text: string): DocsJsonNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: DocsJsonNode[] = [];
  let list: { type: "bulletList" | "orderedList"; items: DocsJsonNode[] } | null = null;

  const flushList = () => {
    if (!list) return;
    out.push({ type: list.type, content: list.items });
    list = null;
  };

  for (const raw of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(raw);
    if (heading) {
      flushList();
      out.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: [{ type: "text", text: heading[2].trim() }],
      });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.+)$/.exec(raw);
    if (bullet) {
      if (list?.type !== "bulletList") {
        flushList();
        list = { type: "bulletList", items: [] };
      }
      list.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: bullet[1] }] }],
      });
      continue;
    }
    const numbered = /^\s*\d+[.)、]\s+(.+)$/.exec(raw);
    if (numbered) {
      if (list?.type !== "orderedList") {
        flushList();
        list = { type: "orderedList", items: [] };
      }
      list.items.push({
        type: "listItem",
        content: [{ type: "paragraph", content: [{ type: "text", text: numbered[1] }] }],
      });
      continue;
    }
    flushList();
    if (!raw.trim()) continue;
    out.push({
      type: "paragraph",
      content: [{ type: "text", text: raw.trim() }],
    });
  }
  flushList();
  return out.length ? out : [{ type: "paragraph" }];
}

type HtmlEl = {
  type: "el";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlChild[];
};
type HtmlChild = HtmlEl | { type: "text"; text: string };

const HTML_SKIP_TAGS = new Set(["script", "style", "noscript", "template"]);
const HTML_VOID_TAGS = new Set(["br", "img", "hr", "meta", "link", "source"]);

function decodeHtml(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, value) => {
      const code = Number(value);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, value) => {
      const code = Number.parseInt(value, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : "";
    });
}

function parseHtmlAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const pattern = /([:@\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match = pattern.exec(raw);
  while (match) {
    const name = match[1].toLowerCase();
    if (name.startsWith("on") || name === "style" || name === "srcset") {
      match = pattern.exec(raw);
      continue;
    }
    attrs[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
    match = pattern.exec(raw);
  }
  return attrs;
}

function parseHtmlTree(html: string, warnings: string[]): HtmlEl {
  const root: HtmlEl = { type: "el", tag: "body", attrs: {}, children: [] };
  const stack: HtmlEl[] = [root];
  const skipped = new Set<string>();
  const pattern = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9]+)\s*>|<([a-zA-Z0-9]+)([^>]*)\/?>|([^<]+)/g;
  let match = pattern.exec(html);
  while (match) {
    if (match[1]) {
      const tag = match[1].toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === tag) {
          stack.splice(index);
          break;
        }
      }
    } else if (match[2]) {
      const tag = match[2].toLowerCase();
      const selfClosing = HTML_VOID_TAGS.has(tag) || /\/\s*>$/.test(match[0]);
      const el: HtmlEl = { type: "el", tag, attrs: parseHtmlAttrs(match[3] || ""), children: [] };
      if (!HTML_SKIP_TAGS.has(stack[stack.length - 1]?.tag || "")) {
        stack[stack.length - 1].children.push(el);
      }
      if (!selfClosing && !HTML_VOID_TAGS.has(tag)) stack.push(el);
      if (["iframe", "object", "embed", "video", "svg", "canvas"].includes(tag)) skipped.add(tag);
    } else if (match[4] && !HTML_SKIP_TAGS.has(stack[stack.length - 1]?.tag || "")) {
      const text = decodeHtml(match[4]);
      if (text.trim()) stack[stack.length - 1].children.push({ type: "text", text });
    }
    match = pattern.exec(html);
  }
  if (skipped.size) {
    warnings.push(`有 ${skipped.size} 类内容无法导入（${[...skipped].join("、")}），已跳过。`);
  }
  return root;
}

function inlineFromChildren(children: HtmlChild[]): DocsJsonNode[] {
  const nodes: DocsJsonNode[] = [];
  const appendText = (text: string, marks?: DocsJsonNode["marks"]) => {
    if (!text) return;
    nodes.push(marks?.length ? { type: "text", text, marks } : { type: "text", text });
  };
  const walk = (child: HtmlChild, marks?: DocsJsonNode["marks"]) => {
    if (child.type === "text") {
      appendText(child.text, marks);
      return;
    }
    if (child.tag === "br") {
      nodes.push({ type: "hardBreak" });
      return;
    }
    const nextMarks = marks ? [...marks] : [];
    if (child.tag === "strong" || child.tag === "b") nextMarks.push({ type: "bold" });
    if (child.tag === "em" || child.tag === "i") nextMarks.push({ type: "italic" });
    child.children.forEach((item) => walk(item, nextMarks.length ? nextMarks : undefined));
  };
  children.forEach((child) => walk(child));
  return nodes;
}

function imageNode(el: HtmlEl, warnings: string[]): DocsJsonNode | null {
  const src = el.attrs.src || "";
  if (!src) {
    warnings.push("有一张图片没有地址，已跳过。");
    return null;
  }
  if (!/^(https?:\/\/|data:image\/|\/)/i.test(src)) {
    warnings.push("有一张图片地址无法使用，已跳过。");
    return null;
  }
  const attrs: Record<string, unknown> = { src, alt: (el.attrs.alt || "").slice(0, 120) };
  const width = Number(el.attrs.width);
  const height = Number(el.attrs.height);
  if (Number.isFinite(width) && width > 0) attrs.width = Math.round(width);
  if (Number.isFinite(height) && height > 0) attrs.height = Math.round(height);
  return { type: "image", attrs };
}

function headingNode(el: HtmlEl): DocsJsonNode {
  const level = Number(el.tag.slice(1)) || 2;
  const attrs: Record<string, unknown> = { level };
  const anchor = el.attrs["data-anchor-id"] || (/^h_[a-z0-9]{8,32}$/.test(el.attrs.id || "") ? el.attrs.id : "");
  if (anchor && /^h_[a-z0-9]{8,32}$/.test(anchor)) attrs.anchorId = anchor;
  const content = inlineFromChildren(el.children);
  return { type: "heading", attrs, content: content.length ? content : [{ type: "text", text: "" }] };
}

function blocksFromElement(el: HtmlEl, warnings: string[]): DocsJsonNode[] {
  if (HTML_SKIP_TAGS.has(el.tag)) return [];
  if (/^h[1-6]$/.test(el.tag)) return [headingNode(el)];
  if (el.tag === "img") {
    const image = imageNode(el, warnings);
    return image ? [image] : [];
  }
  if (el.tag === "ul" || el.tag === "ol") {
    const items = el.children
      .filter((child): child is HtmlEl => child.type === "el" && child.tag === "li")
      .map((item) => ({
        type: "listItem",
        content: blocksFromElement(
          { type: "el", tag: "div", attrs: {}, children: item.children },
          warnings,
        ),
      }));
    return [
      {
        type: el.tag === "ol" ? "orderedList" : "bulletList",
        content: items.length
          ? items
          : [{ type: "listItem", content: [{ type: "paragraph" }] }],
      },
    ];
  }
  if (el.tag === "table") {
    const rows = el.children.flatMap((child) => {
      if (child.type !== "el") return [];
      if (child.tag === "tr") return [child];
      return child.children.filter((row): row is HtmlEl => row.type === "el" && row.tag === "tr");
    });
    const content = rows.map((row) => ({
      type: "tableRow",
      content: row.children
        .filter((cell): cell is HtmlEl => cell.type === "el" && (cell.tag === "td" || cell.tag === "th"))
        .map((cell) => ({
          type: cell.tag === "th" ? "tableHeader" : "tableCell",
          content: blocksFromElement(
            { type: "el", tag: "div", attrs: {}, children: cell.children },
            warnings,
          ),
        })),
    }));
    return [{ type: "table", content }];
  }
  const blockTags = new Set([
    "div",
    "p",
    "ul",
    "ol",
    "table",
    "img",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "section",
    "article",
    "blockquote",
  ]);
  if (
    el.tag === "p" ||
    el.tag === "div" ||
    el.tag === "li" ||
    el.tag === "body" ||
    el.tag === "section" ||
    el.tag === "article" ||
    el.tag === "blockquote"
  ) {
    const blocks: DocsJsonNode[] = [];
    let inline: HtmlChild[] = [];
    const flush = () => {
      const content = inlineFromChildren(inline);
      inline = [];
      if (content.length) blocks.push({ type: "paragraph", content });
    };
    for (const child of el.children) {
      if (child.type === "el" && blockTags.has(child.tag)) {
        flush();
        blocks.push(...blocksFromElement(child, warnings));
      } else {
        inline.push(child);
      }
    }
    flush();
    if (blocks.length) return blocks;
    if (el.tag === "p" || el.tag === "blockquote" || el.tag === "li") return [{ type: "paragraph" }];
    return [];
  }
  return [];
}

export type DocsImportDetails = {
  content: DocsJsonNode;
  warnings: string[];
};

export function importMarkupDetailed(text: string, kind: "txt" | "md" | "html"): DocsImportDetails {
  const warnings: string[] = [];
  const nodes =
    kind === "html"
      ? blocksFromElement(parseHtmlTree(text, warnings), warnings)
      : kind === "md"
        ? markdownToNodes(text)
        : textToParagraphs(text);
  return {
    content: sanitizeDocsContent({ type: "doc", content: nodes }) || emptyDocsContent(),
    warnings,
  };
}

export function importPlainOrMarkup(text: string, kind: "txt" | "md" | "html"): DocsJsonNode {
  return importMarkupDetailed(text, kind).content;
}

export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").trim() || "导入文档";
}
