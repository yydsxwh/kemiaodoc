"use client";

import { useEffect, useState } from "react";
import {
  copyText,
  fetchDocsShares,
  openDocsShare,
  updateDocsShare,
} from "@andyyyds/docs/lib/docs-client";
import { sharePath, type DocsLibrarySnapshot, type DocsShareView } from "@andyyyds/docs/lib/docs-library";

type Props = {
  documentId: string;
  saved: boolean;
  library: DocsLibrarySnapshot | null;
  anchorId?: string | null;
};

export function DocsSharePanel({ documentId, saved, library, anchorId }: Props) {
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState<DocsShareView[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [days, setDays] = useState("0");
  const [watermark, setWatermark] = useState("");
  const [message, setMessage] = useState("");
  const [manualLink, setManualLink] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetchDocsShares({ documentId })
      .then(setShares)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "无法读取分享"));
  }, [documentId, open]);

  const docShare = shares.find((share) => share.scope === "document" && share.documentId === documentId && share.active);
  const absolute = (path: string) => `${window.location.origin}${path}`;

  const copy = async (path: string) => {
    const full = absolute(path);
    const result = await copyText(full);
    if (result === "copied") {
      setMessage("链接已复制");
      setManualLink("");
    } else {
      setMessage("自动复制不可用，请选中下面的链接复制");
      setManualLink(full);
    }
  };

  const enableDoc = async () => {
    if (!saved) {
      setError("请先保存成功，再开启分享。");
      return;
    }
    setError("");
    const share = await openDocsShare({
      scope: "document",
      documentId,
      expiresInDays: Number(days) || 0,
      watermarkText: watermark,
    });
    setShares((current) => [share, ...current.filter((item) => item.id !== share.id)]);
    await copy(sharePath(share.token, null, anchorId));
  };

  const currentPath = (share: DocsShareView, chapter = false) =>
    sharePath(share.token, share.scope === "space" ? documentId : null, chapter ? anchorId : null);

  return (
    <div className="relative">
      <button type="button" className="btn btn-secondary min-h-11 px-3 text-sm" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        分享
      </button>
      {open ? (
        <div className="docs-share-panel">
          <p className="text-sm font-semibold">网页分享</p>
          <p className="text-xs leading-5 text-[var(--muted)]">
            默认只有你自己能编辑。开启后，访客不用登录就能只读。保存成功后，分享页面会更新。
          </p>
          {!saved ? <p className="text-sm text-[var(--fire)]">还有未保存的修改，分享前请先保存。</p> : null}
          <label className="mt-2 block text-xs text-[var(--muted)]">
            有效期
            <select className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm" value={days} onChange={(event) => setDays(event.target.value)}>
              <option value="0">一直有效，直到撤销</option>
              <option value="7">7 天</option>
              <option value="30">30 天</option>
            </select>
          </label>
          <label className="mt-2 block text-xs text-[var(--muted)]">
            水印文字，留空则不显示
            <input className="field mt-1 min-h-11 w-full rounded-xl px-3 text-sm" value={watermark} maxLength={40} onChange={(event) => setWatermark(event.target.value)} />
          </label>
          <button type="button" className="btn btn-primary mt-3 min-h-11 w-full px-3 text-sm" onClick={() => void enableDoc().catch((err: unknown) => setError(err instanceof Error ? err.message : "开启失败"))}>
            {docShare ? "打开单篇分享" : "开启单篇分享"}
          </button>
          {docShare ? (
            <div className="mt-2 grid gap-2">
              <p className="text-xs leading-5">
                范围：只有这一篇。{docShare.expiresAt ? `失效时间 ${new Date(docShare.expiresAt).toLocaleString("zh-CN")}` : "未设置失效时间。"}
              </p>
              <button type="button" className="btn btn-secondary min-h-11 px-3 text-sm" onClick={() => void copy(currentPath(docShare, true))}>
                复制本章链接
              </button>
              <button type="button" className="btn btn-secondary min-h-11 px-3 text-sm" onClick={() => void copy(currentPath(docShare))}>
                复制文档链接
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-3 text-sm"
                onClick={() =>
                  void updateDocsShare({ id: docShare.id, action: "revoke" }).then((share) => {
                    setShares((current) => current.map((item) => (item.id === share.id ? share : item)));
                    setMessage("已撤销。旧链接会立即失效。");
                  })
                }
              >
                撤销分享
              </button>
              <button
                type="button"
                className="btn btn-secondary min-h-11 px-3 text-sm"
                onClick={() =>
                  void updateDocsShare({ id: docShare.id, action: "regenerate" }).then((share) => {
                    setShares((current) => current.map((item) => (item.id === share.id ? share : item)));
                    setMessage("已生成新链接，旧链接失效。");
                  })
                }
              >
                重新生成链接
              </button>
            </div>
          ) : null}
          <div className="mt-4 border-t border-[var(--line)] pt-3">
            <p className="text-sm font-semibold">知识库分享</p>
            <p className="text-xs leading-5 text-[var(--muted)]">只公开勾选的文档。之后新建或放进来的文档仍然是私有的。</p>
            <select className="field mt-2 min-h-11 w-full rounded-xl px-3 text-sm" value={spaceId} onChange={(event) => setSpaceId(event.target.value)}>
              <option value="">选择知识库</option>
              {(library?.spaces || []).map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
            <div className="mt-2 grid max-h-40 gap-1 overflow-auto">
              {(library?.documents || [])
                .filter((doc) =>
                  (library?.nodes || []).some(
                    (node) =>
                      node.spaceId === spaceId &&
                      node.kind === "document" &&
                      node.status === "active" &&
                      node.documentId === doc.id,
                  ),
                )
                .map((doc) => (
                <label key={doc.id} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={picked.includes(doc.id)}
                    onChange={(event) =>
                      setPicked((current) =>
                        event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id),
                      )
                    }
                  />
                  {doc.title}
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary mt-2 min-h-11 w-full px-3 text-sm"
              onClick={() =>
                void openDocsShare({
                  scope: "space",
                  spaceId,
                  documentIds: picked,
                  expiresInDays: Number(days) || 0,
                  watermarkText: watermark,
                })
                  .then(async (share) => {
                    setShares((current) => [share, ...current]);
                    await copy(share.path);
                  })
                  .catch((err: unknown) => setError(err instanceof Error ? err.message : "知识库分享失败"))
              }
            >
              开启知识库分享
            </button>
          </div>
          {message ? <p className="mt-2 text-sm">{message}</p> : null}
          {error ? <p className="mt-2 text-sm text-[var(--fire)]">{error}</p> : null}
          {manualLink ? (
            <label className="mt-2 block text-xs">
              完整链接
              <input className="field mt-1 w-full rounded-xl px-3 py-2 text-sm" readOnly value={manualLink} onFocus={(event) => event.currentTarget.select()} />
            </label>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
