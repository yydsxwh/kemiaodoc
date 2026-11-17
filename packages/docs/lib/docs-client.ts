import type { DocsDocumentPayload, DocsJsonNode } from "@andyyyds/docs/lib/docs-content";
import type { DocsLibrarySnapshot, DocsShareView, DocsWikiAction } from "@andyyyds/docs/lib/docs-library";
import type { DocsPageChrome } from "@andyyyds/docs/lib/docs-page";
import type { DocsSearchSnippet } from "@andyyyds/docs/lib/docs-search";
import type { DocsListScheme } from "@andyyyds/docs/lib/docs-scheme";

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "error" in body) {
    const message = String((body as { error?: unknown }).error || "").trim();
    if (message) return message;
  }
  return fallback;
}

export async function fetchDocsList(): Promise<DocsDocumentPayload[]> {
  const res = await fetch("/api/docs", { credentials: "same-origin" });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法加载文档列表"));
  const items = (body as { items?: DocsDocumentPayload[] }).items;
  return Array.isArray(items) ? items : [];
}

export async function fetchDocsDocument(id: string): Promise<DocsDocumentPayload> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    credentials: "same-origin",
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法打开文档"));
  return body as DocsDocumentPayload;
}

export async function createDocsDocumentRequest(input?: {
  title?: string;
  content?: DocsJsonNode;
  listScheme?: DocsListScheme;
  pageChrome?: DocsPageChrome;
}): Promise<DocsDocumentPayload> {
  const res = await fetch("/api/docs", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input || {}),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "无法新建文档"));
  return body as DocsDocumentPayload;
}

export class DocsSaveConflictError extends Error {
  constructor() {
    super("这篇文档在其他页面已更新。当前编辑还在，没有被覆盖。");
    this.name = "DocsSaveConflictError";
  }
}

export async function saveDocsDocumentRequest(
  id: string,
  input: {
    title?: string;
    content?: DocsJsonNode;
    listScheme?: DocsListScheme;
    pageChrome?: DocsPageChrome;
    baseUpdatedAt?: string;
    force?: boolean;
  },
): Promise<DocsDocumentPayload> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await readJson(res);
  if (res.status === 409) throw new DocsSaveConflictError();
  if (!res.ok) throw new Error(errorMessage(body, "保存失败"));
  return body as DocsDocumentPayload;
}

export async function deleteDocsDocumentRequest(id: string): Promise<void> {
  const res = await fetch(`/api/docs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(errorMessage(body, "删除失败"));
  }
}

export async function importDocsFile(file: File): Promise<{
  title: string;
  content: DocsJsonNode;
  warnings?: string[];
}> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/docs/import", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "打开文件失败"));
  return body as { title: string; content: DocsJsonNode };
}

export async function exportDocsDocxRequest(input: {
  title: string;
  content: DocsJsonNode;
  pageChrome: DocsPageChrome;
}): Promise<Blob> {
  const res = await fetch("/api/docs/export", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const body = await readJson(res);
    throw new Error(errorMessage(body, "另存为 Word 失败"));
  }
  return res.blob();
}

export async function uploadDocsImage(file: File): Promise<{ src: string; previewUrl: string }> {
  const form = new FormData();
  form.set("file", file);
  const res = await fetch("/api/upload/image", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(body, "图片上传失败"));
  const preview = String((body as { previewUrl?: string }).previewUrl || "");
  const url = String((body as { url?: string }).url || "");
  const src = url || preview;
  if (!src) throw new Error("图片上传失败");
  return { src, previewUrl: preview || src };
}

export type DocsSearchHit = {
  documentId: string;
  title: string;
  updatedAt?: string;
  snippet: DocsSearchSnippet | null;
  tags?: string[];
};

async function sendJson(url: string, method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readJson(res);
  if (!res.ok) throw new Error(errorMessage(payload, "操作失败"));
  return payload;
}

export async function fetchDocsLibrary(): Promise<DocsLibrarySnapshot> {
  return (await sendJson("/api/docs/wiki", "GET")) as DocsLibrarySnapshot;
}

export async function applyDocsWiki(action: DocsWikiAction): Promise<DocsLibrarySnapshot> {
  return (await sendJson("/api/docs/wiki", "POST", action)) as DocsLibrarySnapshot;
}

export async function addDocsTag(documentId: string, name: string): Promise<DocsLibrarySnapshot> {
  return (await sendJson("/api/docs/tags", "POST", { documentId, name })) as DocsLibrarySnapshot;
}

export async function removeDocsTag(documentId: string, tagId: string): Promise<DocsLibrarySnapshot> {
  return (await sendJson("/api/docs/tags", "DELETE", { documentId, tagId })) as DocsLibrarySnapshot;
}

export async function searchDocs(query: string, tag?: string): Promise<DocsSearchHit[]> {
  const params = new URLSearchParams({ q: query });
  if (tag) params.set("tag", tag);
  const body = (await sendJson(`/api/docs/search?${params.toString()}`, "GET")) as { hits?: DocsSearchHit[] };
  return body.hits || [];
}

export async function fetchDocsShares(filter: { documentId?: string; spaceId?: string }): Promise<DocsShareView[]> {
  const params = new URLSearchParams();
  if (filter.documentId) params.set("documentId", filter.documentId);
  if (filter.spaceId) params.set("spaceId", filter.spaceId);
  const body = (await sendJson(`/api/docs/shares?${params.toString()}`, "GET")) as { shares?: DocsShareView[] };
  return body.shares || [];
}

export async function openDocsShare(input: Record<string, unknown>): Promise<DocsShareView> {
  return (await sendJson("/api/docs/shares", "POST", input)) as DocsShareView;
}

export async function updateDocsShare(input: Record<string, unknown>): Promise<DocsShareView> {
  return (await sendJson("/api/docs/shares", "PATCH", input)) as DocsShareView;
}

export async function copyText(value: string): Promise<"copied" | "manual"> {
  try {
    if (!navigator.clipboard?.writeText) return "manual";
    await navigator.clipboard.writeText(value);
    return "copied";
  } catch {
    return "manual";
  }
}
