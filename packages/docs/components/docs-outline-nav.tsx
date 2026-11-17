"use client";

import { useState } from "react";
import {
  DOCS_OUTLINE_DEFAULT_MAX_LEVEL,
  visibleOutlineItems,
  type DocsOutlineItem,
} from "@andyyyds/docs/lib/docs-outline";

type Props = {
  items: DocsOutlineItem[];
  activeId: string | null;
  maxLevel: number;
  onMaxLevel: (level: number) => void;
  collapsed: ReadonlySet<string>;
  onToggle: (anchorId: string) => void;
  onJump: (anchorId: string) => void;
};

function hasChildren(items: DocsOutlineItem[], index: number): boolean {
  const current = items[index];
  const next = items[index + 1];
  return Boolean(next && next.level > current.level);
}

export function DocsOutlineNav({
  items,
  activeId,
  maxLevel,
  onMaxLevel,
  collapsed,
  onToggle,
  onJump,
}: Props) {
  const [expandedText, setExpandedText] = useState<string | null>(null);
  const visible = visibleOutlineItems(items, collapsed, maxLevel);
  if (!items.length) {
    return <p className="docs-outline-empty">设置标题后，这里会自动生成目录</p>;
  }
  return (
    <div>
      <label className="docs-outline-level">
        显示到
        <select
          className="field min-h-11 rounded-xl px-2 text-sm"
          value={maxLevel}
          aria-label="目录显示层级"
          onChange={(event) => onMaxLevel(Number(event.target.value) || DOCS_OUTLINE_DEFAULT_MAX_LEVEL)}
        >
          {[1, 2, 3, 4, 5, 6].map((level) => (
            <option key={level} value={level}>
              标题 {level}
            </option>
          ))}
        </select>
      </label>
      <ol className="docs-outline-list">
        {visible.map((item) => {
          const sourceIndex = items.findIndex((candidate) => candidate.anchorId === item.anchorId);
          const child = hasChildren(items, sourceIndex);
          const label = item.empty ? "空标题" : item.text;
          const open = expandedText === item.anchorId;
          const active = activeId === item.anchorId;
          return (
            <li key={item.anchorId} style={{ paddingLeft: `${(item.level - 1) * 12}px` }}>
              <div className={`docs-outline-row ${active ? "is-active" : ""}`}>
                {child ? (
                  <button
                    type="button"
                    className="docs-outline-fold"
                    aria-expanded={!collapsed.has(item.anchorId)}
                    aria-label={collapsed.has(item.anchorId) ? "展开下级标题" : "收起下级标题"}
                    onClick={() => onToggle(item.anchorId)}
                  >
                    {collapsed.has(item.anchorId) ? "▸" : "▾"}
                  </button>
                ) : (
                  <span className="docs-outline-fold" aria-hidden="true" />
                )}
                <button
                  type="button"
                  className="docs-outline-jump"
                  data-outline={item.anchorId}
                  aria-current={active ? "location" : undefined}
                  onClick={() => onJump(item.anchorId)}
                >
                  <span className={open ? "" : "docs-outline-label"}>{label}</span>
                </button>
                {label.length > 18 ? (
                  <button
                    type="button"
                    className="docs-outline-more"
                    aria-expanded={open}
                    onClick={() => setExpandedText(open ? null : item.anchorId)}
                  >
                    {open ? "收起" : "全文"}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
