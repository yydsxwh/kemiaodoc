/**
 * 把文档里的图片地址换成短期可看的地址。
 * 不签别人的文件，也不把本地 /uploads 改成另一套地址。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { DOCS_MEDIA_SIGN_TTL_SEC } from "@andyyyds/docs/lib/docs-access";
import { DocsShareClosedError, resolveDocsMediaUrl } from "@andyyyds/docs/lib/docs-share-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const src = new URL(req.url).searchParams.get("src") || "";
  const token = new URL(req.url).searchParams.get("token") || "";
  const session = token ? null : await getSession();
  try {
    const url = await resolveDocsMediaUrl({
      src,
      token: token || null,
      userId: session?.id || null,
    });
    return NextResponse.json(
      { url, expiresInSec: DOCS_MEDIA_SIGN_TTL_SEC },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof DocsShareClosedError) {
      return NextResponse.json(
        { error: "找不到图片" },
        { status: 404, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    throw error;
  }
}
