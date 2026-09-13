import { notFound, redirect } from "next/navigation";
import { DocsEditor } from "@kemiaodoc/docs/components/docs-editor";
import { DOCS_LOCAL_ID } from "@kemiaodoc/docs/lib/docs-content";
import { getDocsSession } from "@kemiaodoc/docs/lib/docs-host";
import { emptyLocalDocument } from "@kemiaodoc/docs/lib/docs-local";
import { DocsNotFoundError, getDocsDocument } from "@kemiaodoc/docs/lib/docs-store";

/**
 * Next.js App Router 示例页。本地草稿不必登录；云端文档需要 setDocsGetSession。
 */
export default async function DocsEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getDocsSession();

  if (id === DOCS_LOCAL_ID) {
    return (
      <div className="container py-6 sm:py-10">
        <DocsEditor initial={emptyLocalDocument()} loggedIn={Boolean(session)} />
      </div>
    );
  }

  if (!session) {
    redirect(`/login?next=/products/docs/${encodeURIComponent(id)}`);
  }

  try {
    const doc = await getDocsDocument(session.id, id);
    return (
      <div className="container py-6 sm:py-10">
        <DocsEditor initial={doc} loggedIn />
      </div>
    );
  } catch (error) {
    if (error instanceof DocsNotFoundError) notFound();
    throw error;
  }
}
