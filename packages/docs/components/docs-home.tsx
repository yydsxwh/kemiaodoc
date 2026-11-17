"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DocsLibraryNav } from "@andyyyds/docs/components/docs-library-nav";
import { createDocsDocumentRequest } from "@andyyyds/docs/lib/docs-client";
import type { DocsLibrarySnapshot } from "@andyyyds/docs/lib/docs-library";

type Props = {
  loggedIn: boolean;
  library: DocsLibrarySnapshot | null;
};

export function DocsHome({ loggedIn, library }: Props) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(library);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tag, setTag] = useState("");

  const createCloud = async () => {
    setBusy(true);
    setError("");
    try {
      const doc = await createDocsDocumentRequest({ title: "未命名文档" });
      router.push(`/products/docs/${doc.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "新建失败");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {loggedIn ? (
          <button type="button" className="btn btn-primary min-h-11 px-4" disabled={busy} onClick={() => void createCloud()}>
            {busy ? "创建中…" : "新建云端文档"}
          </button>
        ) : (
          <Link href="/login?next=/products/docs" className="btn btn-primary min-h-11 px-4">
            登录后新建云端文档
          </Link>
        )}
        <Link href="/products/docs/local" className="btn btn-secondary min-h-11 px-4">
          打开浏览器草稿
        </Link>
      </div>
      {error ? <p className="text-sm text-[var(--fire)]">{error}</p> : null}
      <p className="text-xs leading-5 text-[var(--muted)]">
        每人最多 80 篇，每篇最多 80 万字符。旧文档仍在「未分类」，放进知识库不会复制正文。
      </p>
      <div className="surface overflow-hidden rounded-[28px]">
        <DocsLibraryNav
          library={snapshot}
          loggedIn={loggedIn}
          currentId=""
          activeTag={tag}
          onLibrary={setSnapshot}
          onTag={setTag}
          onError={setError}
        />
      </div>
    </div>
  );
}
