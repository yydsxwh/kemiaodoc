import { createEmptyDocument, LOCAL_DOC_ID, type KemiaoDocument } from "@kemiaodoc/core"
import { exportDocx, importDocx } from "@kemiaodoc/docx"
import { DocsEditor, DocsWorkspace, createLocalStorageAdapter } from "@kemiaodoc/editor"
import { useMemo, useState } from "react"

const storage = createLocalStorageAdapter()

export function App() {
  const [current, setCurrent] = useState<KemiaoDocument | null>(null)
  const initial = useMemo(() => current ?? createEmptyDocument(LOCAL_DOC_ID), [current])
  const docx = useMemo(
    () => ({
      importFile: (file: File) => importDocx(file, file.name),
      exportFile: exportDocx,
    }),
    [],
  )

  return (
    <div className="demo-shell">
      <header className="demo-hero">
        <h1>科苗文档</h1>
        <p>
          从歪歪滴艾斯（andyyyds）网页文档抽出的公共编辑包。其他产品可安装
          <code> @kemiaodoc/editor </code>
          后直接引用同一套编辑、导入导出和打印能力。
        </p>
      </header>
      {current ? (
        <DocsEditor
          initial={initial}
          storage={storage}
          docx={docx}
          onNavigateHome={() => setCurrent(null)}
        />
      ) : (
        <DocsWorkspace storage={storage} onOpen={setCurrent} />
      )}
    </div>
  )
}
