/**
 * POST /api/upload/image
 * 任意已登录用户上传图片（约搭封面、课程封面、图集等）。
 * 与装修后台 decorate/upload（仅站长）分开，避免发起人无法传封面。
 */

import { NextResponse } from "next/server";
import { getSession } from "@andyyyds/shared/auth";
import { resolveStoredAccessUrl, storeUpload } from "@andyyyds/shared/storage";
import { inspectImageUpload } from "@andyyyds/shared/security/upload-policy";

export const runtime = "nodejs";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "图片不能超过 8MB" }, { status: 400 });
    }
    const mime = file.type || "application/octet-stream";
    const peeked = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const inspected = inspectImageUpload({
      fileName: file.name || "image.png",
      mime,
      size: file.size,
      bytes: peeked.length >= 4 ? peeked : new Uint8Array(await file.arrayBuffer()),
      maxBytes: MAX_IMAGE_BYTES,
    });
    if (!inspected.ok) {
      return NextResponse.json({ error: inspected.error }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({
      ownerId: session.id,
      fileName: file.name || "image.jpg",
      buffer,
      mimeType: mime.startsWith("image/") ? mime : "image/jpeg",
      kind: "file",
    });

    // 私有 Bucket 时返回可立刻预览的签名 URL；入库仍可用 canonical fileUrl
    const previewUrl = await resolveStoredAccessUrl(stored.fileUrl);
    return NextResponse.json({
      url: stored.fileUrl,
      previewUrl: previewUrl || stored.fileUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
