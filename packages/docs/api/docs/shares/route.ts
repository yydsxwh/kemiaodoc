/**
 * 作者管理分享。这里不提供访客读取。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { listDocsShares, openDocsShare, updateDocsShare } from "@andyyyds/docs/lib/docs-share-store";
import { DocsWikiError } from "@andyyyds/docs/lib/docs-wiki-store";

export const runtime = "nodejs";

function fail(error: unknown) {
  if (error instanceof DocsWikiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "分享设置失败";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const shares = await listDocsShares(session.id, {
    documentId: url.searchParams.get("documentId") || undefined,
    spaceId: url.searchParams.get("spaceId") || undefined,
  });
  return NextResponse.json({ shares }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let body: {
    scope?: "document" | "space";
    documentId?: string;
    spaceId?: string;
    documentIds?: unknown;
    expiresInDays?: unknown;
    watermarkText?: unknown;
    watermarkOpacity?: unknown;
    watermarkOnPrint?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }
  try {
    const share = await openDocsShare(session.id, {
      scope: body.scope === "space" ? "space" : "document",
      documentId: body.documentId,
      spaceId: body.spaceId,
      documentIds: body.documentIds,
      expiresInDays: body.expiresInDays,
      watermarkText: body.watermarkText,
      watermarkOpacity: body.watermarkOpacity,
      watermarkOnPrint: body.watermarkOnPrint,
    });
    return NextResponse.json(share);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let body: {
    id?: string;
    action?: "revoke" | "regenerate" | "update";
    documentIds?: unknown;
    expiresInDays?: unknown;
    watermarkText?: unknown;
    watermarkOpacity?: unknown;
    watermarkOnPrint?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }
  try {
    const share = await updateDocsShare(session.id, String(body.id || ""), body);
    return NextResponse.json(share);
  } catch (error) {
    return fail(error);
  }
}
