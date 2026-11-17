/**
 * 打开 Word / WPS：服务端用 mammoth 抽 HTML，再收成文档 JSON。
 * 旧版二进制 .doc 解不了，请用户另存为 .docx。
 */

import mammoth from "mammoth";
import {
  emptyDocsContent,
  inferDocsTitle,
  sanitizeDocsContent,
  type DocsJsonNode,
} from "@andyyyds/docs/lib/docs-content";
import { importMarkupDetailed, titleFromFileName } from "@andyyyds/docs/lib/docs-html";

export const DOCS_IMPORT_MAX_BYTES = 8 * 1024 * 1024;

export type DocsImportResult = {
  title: string;
  content: DocsJsonNode;
  warnings: string[];
};

function isZip(buf: Buffer): boolean {
  return buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b;
}

function isOle(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0xd0 &&
    buf[1] === 0xcf &&
    buf[2] === 0x11 &&
    buf[3] === 0xe0
  );
}

export async function importOfficeBuffer(
  buffer: Buffer,
  fileName: string,
  options?: {
    uploadImage?: (image: Buffer, contentType: string) => Promise<string>;
  },
): Promise<DocsImportResult> {
  if (buffer.length > DOCS_IMPORT_MAX_BYTES) {
    throw new Error("文件不能超过 8MB");
  }
  if (isOle(buffer)) {
    throw new Error("旧版 .doc / .wps 打不开，请用 WPS 或 Word 另存为 .docx 再打开");
  }
  if (!isZip(buffer)) {
    throw new Error("请打开 Word / WPS（.docx）文件");
  }
  const warnings: string[] = [];
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        try {
          const bytes = Buffer.from(await image.read());
          const contentType = image.contentType || "image/png";
          if (options?.uploadImage) {
            const src = await options.uploadImage(bytes, contentType);
            return { src };
          }
          if (bytes.length > 180_000) {
            warnings.push("有图片较大，未登录时已跳过。登录后重新打开，图片会上传到云端。");
            return { src: "" };
          }
          return { src: `data:${contentType};base64,${bytes.toString("base64")}` };
        } catch {
          warnings.push("有一张 Word 图片没有导入。");
          return { src: "" };
        }
      }),
    },
  );
  const html = String(result.value || "").trim();
  const imported = html ? importMarkupDetailed(html, "html") : { content: emptyDocsContent(), warnings: [] };
  if (result.messages?.length) warnings.push("Word 里有部分格式没能保留。图片仍会按能识别的方式导入。");
  const content = sanitizeDocsContent(imported.content);
  const title = inferDocsTitle(content, titleFromFileName(fileName));
  return { title, content, warnings: [...warnings, ...imported.warnings] };
}
