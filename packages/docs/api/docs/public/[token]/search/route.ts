/** 访客搜索只覆盖当前分享允许的文档。 */

import { NextResponse } from "next/server";
import { DocsShareClosedError, searchPublicDocs } from "@andyyyds/docs/lib/docs-share-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  try {
    const hits = await searchPublicDocs(token, new URL(req.url).searchParams.get("q"));
    return NextResponse.json(
      { hits, scope: "share" },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof DocsShareClosedError) {
      return NextResponse.json(
        { error: error.message },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw error;
  }
}
