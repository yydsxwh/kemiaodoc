import { DocsPublicView } from "@andyyyds/docs/components/docs-public-view";
import { DocsShareClosedError, readPublicDocs } from "@andyyyds/docs/lib/docs-share-store";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";

export default async function DocsSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ doc?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  try {
    const payload = await readPublicDocs(token, query.doc || null);
    return (
      <NavPageTemplateShell type="products">
        <div className="px-3 py-4 sm:px-6">
          <DocsPublicView token={token} initial={payload} />
        </div>
      </NavPageTemplateShell>
    );
  } catch (error) {
    if (error instanceof DocsShareClosedError) {
      return (
        <NavPageTemplateShell type="products">
          <div className="mx-auto max-w-xl px-4 py-16 text-center">
            <h1 className="text-2xl font-semibold">这个分享链接现在打不开</h1>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
              链接可能已撤销、过期，或这篇文档没有公开。
            </p>
          </div>
        </NavPageTemplateShell>
      );
    }
    throw error;
  }
}
