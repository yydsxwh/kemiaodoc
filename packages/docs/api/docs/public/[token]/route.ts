/**
 * 访客只读。无效、撤销、过期和未授权的文档都用同一句提示，避免探出私有文档。
 */

import { NextResponse } from "next/server";
import { DocsShareClosedError, readPublicDocs } from "@andyyyds/docs/lib/docs-share-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };

export async function GET(req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const doc = new URL(req.url).searchParams.get("doc");
  try {
    const payload = await readPublicDocs(token, doc);
    return NextResponse.json(payload, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof DocsShareClosedError) {
      return NextResponse.json({ error: error.message }, { status: 404, headers: PRIVATE_HEADERS });
    }
    throw error;
  }
}
