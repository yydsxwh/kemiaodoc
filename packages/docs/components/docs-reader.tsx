"use client";

import { useEffect, useState } from "react";
import type { DocsJsonNode } from "@andyyyds/docs/lib/docs-content";

type Props = {
  content: DocsJsonNode;
  media?: Record<string, string>;
  onZoom?: (src: string, alt: string) => void;
};

function marksOf(node: DocsJsonNode): { bold: boolean; italic: boolean } {
  const marks = node.marks || [];
  return {
    bold: marks.some((mark) => mark.type === "bold"),
    italic: marks.some((mark) => mark.type === "italic"),
  };
}

function Inline({ nodes }: { nodes?: DocsJsonNode[] }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === "hardBreak") return <br key={index} />;
        if (node.type === "text") {
          const marks = marksOf(node);
          const text = node.text || "";
          if (marks.bold && marks.italic) return <strong key={index}><em>{text}</em></strong>;
          if (marks.bold) return <strong key={index}>{text}</strong>;
          if (marks.italic) return <em key={index}>{text}</em>;
          return <span key={index}>{text}</span>;
        }
        return <Inline key={index} nodes={node.content} />;
      })}
    </>
  );
}

function ImageBlock({
  node,
  media,
  onZoom,
}: {
  node: DocsJsonNode;
  media?: Record<string, string>;
  onZoom?: (src: string, alt: string) => void;
}) {
  const canonical = String(node.attrs?.src || "");
  const alt = String(node.attrs?.alt || "");
  const width = Number(node.attrs?.width) || 0;
  const height = Number(node.attrs?.height) || 0;
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = media?.[canonical] || canonical;
  const ratio = width > 0 && height > 0 ? `${width} / ${height}` : undefined;
  if (!canonical) return null;
  if (failed) {
    return (
      <p className="docs-image-fallback">
        图片没加载出来
        <button type="button" onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>
          重试
        </button>
      </p>
    );
  }
  return (
    <button
      type="button"
      className="docs-image-button"
      onClick={() => onZoom?.(src, alt)}
    >
      <img
        key={`${canonical}-${attempt}`}
        src={src}
        alt={alt}
        width={width || undefined}
        height={height || undefined}
        style={{ aspectRatio: ratio, maxWidth: width ? `min(100%, ${width}px)` : "100%" }}
        onError={() => setFailed(true)}
      />
      <span className="sr-only">查看大图</span>
    </button>
  );
}

function Blocks({ nodes, media, onZoom }: { nodes?: DocsJsonNode[]; media?: Record<string, string>; onZoom?: Props["onZoom"] }) {
  if (!nodes?.length) return null;
  return (
    <>
      {nodes.map((node, index) => (
        <Block key={index} node={node} media={media} onZoom={onZoom} />
      ))}
    </>
  );
}

function Block({ node, media, onZoom }: { node: DocsJsonNode; media?: Record<string, string>; onZoom?: Props["onZoom"] }) {
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(1, Number(node.attrs?.level) || 2));
    const Tag = `h${level}` as "h1";
    const anchorId = String(node.attrs?.anchorId || "");
    return (
      <Tag id={anchorId || undefined} data-anchor-id={anchorId || undefined}>
        <Inline nodes={node.content} />
      </Tag>
    );
  }
  if (node.type === "paragraph") {
    return <p><Inline nodes={node.content} /></p>;
  }
  if (node.type === "bulletList" || node.type === "orderedList") {
    const Tag = node.type === "orderedList" ? "ol" : "ul";
    return (
      <Tag>
        {(node.content || []).map((item, index) => (
          <li key={index}>
            <Blocks nodes={item.content} media={media} onZoom={onZoom} />
          </li>
        ))}
      </Tag>
    );
  }
  if (node.type === "image") return <ImageBlock node={node} media={media} onZoom={onZoom} />;
  if (node.type === "table") {
    return (
      <div className="docs-table-wrap">
        <table>
          <tbody>
            {(node.content || []).map((row, rowIndex) => (
              <tr key={rowIndex}>
                {(row.content || []).map((cell, cellIndex) => {
                  const Tag = cell.type === "tableHeader" ? "th" : "td";
                  return (
                    <Tag key={cellIndex}>
                      <Blocks nodes={cell.content} media={media} onZoom={onZoom} />
                    </Tag>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <Blocks nodes={node.content} media={media} onZoom={onZoom} />;
}

export function DocsReader({ content, media, onZoom }: Props) {
  return (
    <article className="docs-prose docs-reader">
      <Blocks nodes={content.content} media={media} onZoom={onZoom} />
    </article>
  );
}

export function DocsLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "+" || event.key === "=") setScale((value) => Math.min(4, value + 0.25));
      if (event.key === "-") setScale((value) => Math.max(1, value - 0.25));
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="docs-lightbox" role="dialog" aria-modal="true" aria-label="查看图片">
      <div className="docs-lightbox-bar">
        <button type="button" className="btn btn-secondary min-h-11 px-3" onClick={() => setScale((value) => Math.max(1, value - 0.25))}>
          缩小
        </button>
        <button type="button" className="btn btn-secondary min-h-11 px-3" onClick={() => setScale((value) => Math.min(4, value + 0.25))}>
          放大
        </button>
        <button type="button" className="btn btn-primary min-h-11 px-3" onClick={onClose}>
          关闭
        </button>
      </div>
      <div
        className="docs-lightbox-stage"
        onPointerDown={(event) => {
          if (scale <= 1) return;
          const startX = event.clientX;
          const startY = event.clientY;
          const origin = offset;
          const move = (next: PointerEvent) => {
            setOffset({ x: origin.x + next.clientX - startX, y: origin.y + next.clientY - startY });
          };
          const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
      </div>
    </div>
  );
}
