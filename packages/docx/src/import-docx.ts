import mammoth from "mammoth"
import { importTextFile, sanitizeTitle, type DocNode } from "@kemiaodoc/core"

export async function importDocx(file: Blob, fileName = "导入文档"): Promise<{ title: string; content: DocNode }> {
  const buffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer })
  return {
    title: sanitizeTitle(fileName.replace(/\.[^.]+$/, "")),
    content: importTextFile(result.value, "html"),
  }
}
