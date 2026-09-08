"use client";

import { useState } from "react";
import type { DocsDocumentPayload } from "@kemiaodoc/docs/lib/docs-content";
import { createDocsDocumentRequest } from "@kemiaodoc/docs/lib/docs-client";
import { DocsLink } from "@kemiaodoc/docs/components/docs-link";
import { docsNavigate } from "@kemiaodoc/docs/lib/docs-navigation";

type Props = {
  loggedIn: boolean;
  documents: DocsDocumentPayload[];
  homeHref?: string;
  localHref?: string;
  loginHref?: string;
};

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function DocsHome({
  loggedIn,
  documents,
  homeHref = "/products/docs",
  localHref = "/products/docs/local",
  loginHref = "/login?next=/products/docs",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const createCloud = async () => {
    setBusy(true);
    setError("");
    try {
      const doc = await createDocsDocumentRequest({ title: "未命名文档" });
      docsNavigate(`${homeHref}/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "新建失败");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {loggedIn ? (
          <button
            type="button"
            className="btn btn-primary min-h-11 px-4"
            disabled={busy}
            onClick={() => void createCloud()}
          >
            {busy ? "创建中…" : "新建云端文档"}
          </button>
        ) : (
          <DocsLink href={loginHref} className="btn btn-primary min-h-11 px-4">
            登录后新建云端文档
          </DocsLink>
        )}
        <DocsLink href={localHref} className="btn btn-secondary min-h-11 px-4">
          打开浏览器草稿
        </DocsLink>
      </div>
      {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}

      {loggedIn ? (
        documents.length ? (
          <ul className="grid gap-3">
            {documents.map((doc) => (
              <li key={doc.id}>
                <DocsLink
                  href={`${homeHref}/${doc.id}`}
                  className="surface block rounded-[24px] p-4 transition hover:-translate-y-0.5 sm:p-5"
                >
                  <h2 className="text-lg font-semibold text-[var(--ink)]">{doc.title}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    更新于 {formatTime(doc.updatedAt)}
                  </p>
                </DocsLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--muted)]">还没有云端文档。点上面新建一篇。</p>
        )
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          未登录也可以先在浏览器里写；换设备或清缓存会丢。登录后可保存多篇到云端。
        </p>
      )}
    </div>
  );
}
