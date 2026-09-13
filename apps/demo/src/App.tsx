import { createEmptyDocument, LOCAL_DOC_ID, type KemiaoDocument } from "@kemiaodoc/core"
import { exportDocx, importDocx } from "@kemiaodoc/docx"
import {
  DocsEditor,
  DocsWorkspace,
  createDurableAdapter,
  createLocalVaultAdapter,
  createOnlineGate,
} from "@kemiaodoc/editor"
import { useMemo, useState } from "react"

const storage = createDurableAdapter(createOnlineGate(createLocalVaultAdapter()))

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
          写作业时不用自己点保存：联网会实时存到云端，没网先存在这台电脑，关页或死机也能找回。其他产品可安装
          <code> @kemiaodoc/editor </code>
          后直接引用。
        </p>
      </header>
      {current ? (
        <DocsEditor
          initial={initial}
          loggedIn
          storage={storage}
          docx={docx}
          onNavigateHome={() => setCurrent(null)}
        />
      ) : (
        <DocsWorkspace loggedIn storage={storage} onOpen={setCurrent} />
      )}
    </div>
  )
}
