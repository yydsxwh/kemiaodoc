/** 文档标签。改名不改 key，关联不会断。 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { addDocumentTag, DocsWikiError, removeDocumentTag, renameDocsTag } from "@andyyyds/docs/lib/docs-wiki-store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let body: { documentId?: string; name?: string; tagId?: string; action?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }
  try {
    const library =
      body.action === "rename"
        ? await renameDocsTag(session.id, String(body.tagId || ""), body.name)
        : await addDocumentTag(session.id, String(body.documentId || ""), body.name);
    return NextResponse.json(library);
  } catch (error) {
    if (error instanceof DocsWikiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "标签保存失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  let body: { documentId?: string; tagId?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "请求格式不对" }, { status: 400 });
  }
  try {
    const library = await removeDocumentTag(
      session.id,
      String(body.documentId || ""),
      String(body.tagId || ""),
    );
    return NextResponse.json(library);
  } catch (error) {
    if (error instanceof DocsWikiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
