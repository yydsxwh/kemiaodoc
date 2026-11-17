"use client";

/**
 * 标题带稳定 anchorId。粘贴进来的标题清掉旧 id，避免和原文重复。
 * 缺 id 的新标题在这次编辑里补一个新 id，不改已经有 id 的标题。
 */

import Image from "@tiptap/extension-image";
import Heading from "@tiptap/extension-heading";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { Fragment, type Node as ProseNode, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { useEffect, useState } from "react";
import { createHeadingAnchorId, isHeadingAnchorId } from "@andyyyds/docs/lib/docs-outline";

const previewCache = new Map<string, string>();

export function rememberDocsImagePreview(src: string, previewUrl: string) {
  if (src && previewUrl) previewCache.set(src, previewUrl);
}

function stripPastedAnchors(node: ProseNode): ProseNode {
  const children: ProseNode[] = [];
  node.content.forEach((child) => children.push(stripPastedAnchors(child)));
  const content = Fragment.fromArray(children);
  if (node.type.name !== "heading") return node.copy(content);
  return node.type.create({ ...node.attrs, anchorId: null }, content, node.marks);
}

function DocsImageView({ node }: NodeViewProps) {
  const canonical = String(node.attrs.src || "");
  const width = Number(node.attrs.width) || 0;
  const height = Number(node.attrs.height) || 0;
  const [src, setSrc] = useState(previewCache.get(canonical) || canonical);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const cached = previewCache.get(canonical);
    if (!canonical || canonical.startsWith("data:") || canonical.startsWith("/") || cached) {
      setSrc(cached || canonical);
      return;
    }
    const params = new URLSearchParams({ src: canonical });
    fetch(`/api/docs/media?${params.toString()}`, { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return canonical;
        const body = (await res.json()) as { url?: string };
        return body.url || canonical;
      })
      .then((next) => {
        if (!cancelled) setSrc(next);
      })
      .catch(() => {
        if (!cancelled) setSrc(canonical);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, canonical]);

  const ratio = width > 0 && height > 0 ? `${width} / ${height}` : undefined;
  return (
    <NodeViewWrapper className="docs-image-frame" data-drag-handle>
      {failed ? (
        <span className="docs-image-fallback">
          图片没加载出来
          <button type="button" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
            重试
          </button>
        </span>
      ) : (
        <img
          src={src}
          alt={String(node.attrs.alt || "")}
          width={width || undefined}
          height={height || undefined}
          style={{ aspectRatio: ratio, maxWidth: width ? `min(100%, ${width}px)` : "100%" }}
          onError={() => setFailed(true)}
        />
      )}
    </NodeViewWrapper>
  );
}

export const DocsImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute("width")) || null,
        renderHTML: (attributes) => (attributes.width ? { width: attributes.width } : {}),
      },
      height: {
        default: null,
        parseHTML: (element) => Number(element.getAttribute("height")) || null,
        renderHTML: (attributes) => (attributes.height ? { height: attributes.height } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(DocsImageView);
  },
}).configure({ inline: false, allowBase64: true });

export const DocsHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      anchorId: {
        default: null,
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute("data-anchor-id"),
        renderHTML: (attributes) =>
          isHeadingAnchorId(attributes.anchorId)
            ? { id: attributes.anchorId, "data-anchor-id": attributes.anchorId }
            : {},
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        key: new PluginKey("docsHeadingIdentity"),
        props: {
          transformPasted(slice) {
            const content = slice.content;
            const nodes: ProseNode[] = [];
            content.forEach((node) => nodes.push(stripPastedAnchors(node)));
            return new Slice(Fragment.fromArray(nodes), slice.openStart, slice.openEnd);
          },
        },
        appendTransaction(transactions, _oldState, state) {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;
          const used = new Set<string>();
          let changed = false;
          const tr = state.tr;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "heading") return;
            const current = node.attrs.anchorId;
            if (isHeadingAnchorId(current) && !used.has(current)) {
              used.add(current);
              return;
            }
            let next = createHeadingAnchorId();
            while (used.has(next)) next = createHeadingAnchorId();
            used.add(next);
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, anchorId: next });
            changed = true;
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
}).configure({ levels: [1, 2, 3, 4, 5, 6] });
