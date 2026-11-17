/** 作者在自己的文档里搜索。不返回别人的标题或正文。 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { searchOwnedDocs } from "@andyyyds/docs/lib/docs-wiki-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const url = new URL(req.url);
  const hits = await searchOwnedDocs(
    session.id,
    url.searchParams.get("q"),
    url.searchParams.get("tag") || "",
  );
  return NextResponse.json(
    { hits, scope: "mine" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
