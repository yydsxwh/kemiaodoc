"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { DocsPublicPayload } from "@andyyyds/docs/lib/docs-share-store";
import { copyText, type DocsSearchHit } from "@andyyyds/docs/lib/docs-client";
import { sharePath } from "@andyyyds/docs/lib/docs-library";
import { activeOutlineAnchor, extractOutline } from "@andyyyds/docs/lib/docs-outline";
import { DocsOutlineNav } from "@andyyyds/docs/components/docs-outline-nav";
import { DocsLightbox, DocsReader } from "@andyyyds/docs/components/docs-reader";
import "./docs-editor.css";

type Props = {
  token: string;
  initial: DocsPublicPayload;
};

export function DocsPublicView({ token, initial }: Props) {
  const [payload, setPayload] = useState(initial);
  const current = payload.document;
  const [pane, setPane] = useState<"library" | "outline">("outline");
  const [drawer, setDrawer] = useState(false);
  const [maxLevel, setMaxLevel] = useState(3);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [missing, setMissing] = useState("");
  const [zoom, setZoom] = useState<{ src: string; alt: string } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<DocsSearchHit[] | null>(null);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const outline = useMemo(
    () => (current ? extractOutline(current.content, current.id) : []),
    [current],
  );

  const openDoc = async (id: string) => {
    const res = await fetch(`/api/docs/public/${encodeURIComponent(token)}?doc=${encodeURIComponent(id)}`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      setMessage("这个分享链接现在打不开。");
      return;
    }
    const next = (await res.json()) as DocsPublicPayload;
    setPayload(next);
    setDrawer(false);
    setHits(null);
    const url = sharePath(token, payload.scope === "space" ? id : null);
    window.history.pushState(null, "", url);
  };

  useEffect(() => {
    const root = window.document.querySelector(".docs-reading-column");
    if (!(root instanceof HTMLElement)) return;
    let frame = 0;
    const update = () => {
      const positions = outline.flatMap((item) => {
        const element = window.document.querySelector(`.docs-reader [data-anchor-id="${item.anchorId}"]`);
        if (!(element instanceof HTMLElement)) return [];
        return [{ anchorId: item.anchorId, top: element.getBoundingClientRect().top - root.getBoundingClientRect().top }];
      });
      const scrolling = root.scrollHeight > root.clientHeight + 24;
      const nearBottom = scrolling
        ? root.scrollTop + root.clientHeight >= root.scrollHeight - 8
        : window.scrollY + window.innerHeight >= window.document.documentElement.scrollHeight - 8;
      setActive(activeOutlineAnchor(positions, 88, nearBottom));
    };
    const onScroll = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(update);
    };
    root.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.cancelAnimationFrame(frame);
      root.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
    };
  }, [outline]);

  const jump = (anchorId: string) => {
    const target = window.document.querySelector(`.docs-reader [data-anchor-id="${anchorId}"]`) as HTMLElement | null;
    if (!target || !outline.some((item) => item.anchorId === anchorId)) {
      setMissing("章节已调整或删除");
      return;
    }
    setMissing("");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    const url = sharePath(token, payload.scope === "space" ? current?.id : null, anchorId);
    if (window.location.hash !== `#${anchorId}`) window.history.pushState(null, "", url);
    setActive(anchorId);
    setDrawer(false);
  };

  return (
    <div className="docs-shell">
      <div className="docs-mobile-bar docs-no-print">
        <button type="button" className="btn btn-secondary min-h-11 px-3 text-sm" onClick={() => setDrawer(true)}>
          目录
        </button>
      </div>
      {missing ? <p className="docs-missing" role="status">{missing}</p> : null}
      <aside className={`docs-sidebar docs-no-print ${drawer ? "is-open" : ""}`}>
        <div className="docs-pane-switch">
          <button type="button" className={`btn min-h-11 flex-1 px-3 text-sm ${pane === "library" ? "btn-primary" : "btn-secondary"}`} onClick={() => setPane("library")}>
            知识库
          </button>
          <button type="button" className={`btn min-h-11 flex-1 px-3 text-sm ${pane === "outline" ? "btn-primary" : "btn-secondary"}`} onClick={() => setPane("outline")}>
            本篇目录
          </button>
        </div>
        {pane === "library" ? (
          <div className="grid gap-2 px-3 py-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const params = new URLSearchParams({ q: query });
                void fetch(`/api/docs/public/${encodeURIComponent(token)}/search?${params.toString()}`)
                  .then(async (res) => {
                    if (!res.ok) throw new Error("搜索失败");
                    const body = (await res.json()) as { hits?: DocsSearchHit[] };
                    setHits(body.hits || []);
                  })
                  .catch(() => setMessage("搜索失败"));
              }}
            >
              <label className="text-xs text-[var(--muted)]" htmlFor="share-search">
                {payload.scope === "space" ? "在已分享的文档中搜索" : "在本文中搜索"}
              </label>
              <div className="mt-1 flex gap-2">
                <input id="share-search" className="field min-h-11 min-w-0 flex-1 rounded-xl px-3 text-sm" value={query} onChange={(event) => setQuery(event.target.value)} />
                <button className="btn btn-secondary min-h-11 px-3 text-sm" type="submit">搜索</button>
              </div>
            </form>
            {hits?.map((hit) => (
              <button key={hit.documentId} type="button" className="docs-tree-link text-left" onClick={() => void openDoc(hit.documentId)}>
                <strong>{hit.title}</strong>
                {hit.snippet ? <span>{hit.snippet.text}</span> : null}
              </button>
            ))}
            <ul className="grid gap-1">
              {payload.documents.map((item) => (
                <li key={item.id}>
                  <button type="button" className={`docs-tree-link w-full text-left ${item.id === current?.id ? "is-current" : ""}`} onClick={() => void openDoc(item.id)}>
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
            {payload.tags.length ? (
              <p className="text-xs text-[var(--muted)]">
                公开标签：{payload.tags.map((tag) => `${tag.name} ${tag.count}`).join("、")}
              </p>
            ) : null}
          </div>
        ) : (
          <DocsOutlineNav
            items={outline}
            activeId={active}
            maxLevel={maxLevel}
            onMaxLevel={setMaxLevel}
            collapsed={collapsed}
            onToggle={(anchorId) =>
              setCollapsed((current) => {
                const next = new Set(current);
                if (next.has(anchorId)) next.delete(anchorId);
                else next.add(anchorId);
                return next;
              })
            }
            onJump={jump}
          />
        )}
        <button type="button" className="btn btn-secondary docs-drawer-close min-h-11 px-3 text-sm" onClick={() => setDrawer(false)}>
          关闭目录
        </button>
      </aside>
      {drawer ? <button type="button" className="docs-drawer-mask" aria-label="关闭目录" onClick={() => setDrawer(false)} /> : null}
      <div className="docs-reading-column">
        <nav className="docs-breadcrumb" aria-label="当前位置">
          {payload.breadcrumb.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index ? " / " : ""}
              {crumb.label}
            </span>
          ))}
          {current ? <span className="docs-updated">更新于 {new Date(current.updatedAt).toLocaleString("zh-CN")}</span> : null}
        </nav>
        <p className="px-4 text-xs leading-5 text-[var(--muted)]">{payload.notice}</p>
        {payload.expiresAt ? (
          <p className="px-4 text-xs text-[var(--muted)]">链接失效时间 {new Date(payload.expiresAt).toLocaleString("zh-CN")}</p>
        ) : null}
        <p className="px-4 text-xs text-[var(--muted)]">图片预览地址大约 {Math.round(payload.mediaExpiresInSec / 60)} 分钟内有效，刷新页面会重新签发。已经下载或截图的副本无法收回。</p>
        <div className="relative">
          {payload.watermark.text ? (
            <div
              className={`docs-watermark ${payload.watermark.onPrint ? "docs-watermark-print" : ""}`}
              aria-hidden="true"
              style={{
                opacity: payload.watermark.opacity,
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='280' height='180'><text x='12' y='100' fill='%230f172a' font-size='18' transform='rotate(-18 140 90)'>${payload.watermark.text.replace(/[<>&]/g, "")}</text></svg>`)}")`,
              }}
            />
          ) : null}
          {current ? (
            <>
              <h1 className="px-4 pt-4 text-2xl font-semibold">{current.title}</h1>
              <button
                type="button"
                className="btn btn-secondary mx-4 mt-2 min-h-11 px-3 text-sm"
                onClick={() => {
                  const path = sharePath(token, payload.scope === "space" ? current.id : null, active);
                  const full = `${window.location.origin}${path}`;
                  void copyText(full).then((result) => {
                    if (result === "copied") {
                      setMessage("链接已复制");
                      setManual("");
                    } else {
                      setMessage("请手动选择下面的链接");
                      setManual(full);
                    }
                  });
                }}
              >
                复制章节链接
              </button>
              {manual ? <input className="field mx-4 mt-2 w-[calc(100%-2rem)] rounded-xl px-3 py-2 text-sm" readOnly value={manual} onFocus={(event) => event.currentTarget.select()} /> : null}
              {message ? <p className="px-4 py-2 text-sm">{message}</p> : null}
              <DocsReader content={current.content} media={payload.media} onZoom={(src, alt) => setZoom({ src, alt })} />
            </>
          ) : (
            <p className="px-4 py-8 text-sm text-[var(--muted)]">这个分享里还没有公开文档。</p>
          )}
        </div>
        <p className="docs-no-print px-4 py-6 text-sm">
          <Link href="/products/docs" className="text-[var(--brand)]">颗秒文档</Link>
        </p>
      </div>
      {zoom ? <DocsLightbox src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} /> : null}
    </div>
  );
}
