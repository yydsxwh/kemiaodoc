/**
 * 知识库目录的读写。只动当前登录用户自己的空间和节点。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import type { DocsWikiAction } from "@andyyyds/docs/lib/docs-library";
import { applyDocsWikiAction, DocsWikiError, getDocsLibrary } from "@andyyyds/docs/lib/docs-wiki-store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  return NextResponse.json(await getDocsLibrary(session.id));
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let body: DocsWikiAction;
  try {
    body = (await req.json()) as DocsWikiAction;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }
  try {
    const library = await applyDocsWikiAction(session.id, body);
    return NextResponse.json(library);
  } catch (error) {
    if (error instanceof DocsWikiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "操作失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
