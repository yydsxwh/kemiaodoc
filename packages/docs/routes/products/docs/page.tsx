import { DocsHome } from "@kemiaodoc/docs/components/docs-home";
import { DocsLink } from "@kemiaodoc/docs/components/docs-link";
import { getDocsSession } from "@kemiaodoc/docs/lib/docs-host";
import { listDocsDocuments } from "@kemiaodoc/docs/lib/docs-store";

/**
 * Next.js App Router 示例页。宿主可包自己的导航壳，并在启动时调用
 * setDocsPrisma / setDocsGetSession。
 */
export default async function DocsIndexPage() {
  const session = await getDocsSession();
  const documents = session ? await listDocsDocuments(session.id) : [];

  return (
    <div className="container py-10 sm:py-12">
      <header className="mb-8 max-w-2xl">
        <p className="text-sm font-medium text-[var(--brand)]">软件产品 · 网页文档</p>
        <h1 className="brand-mark mt-2 text-3xl font-semibold sm:text-4xl">网页文档</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
          在浏览器里写文档：标题、正文、加粗、多级标题、项目符号、可自定义的多级编号、插图和简单表格。
          可打开 Word / HTML / 文本，另存为 Word 或 HTML，并设置页眉页脚页码后打印。
          手机微信里同样能点、能改。
        </p>
        <p className="mt-2 text-xs">
          <DocsLink
            href="/products"
            className="font-medium text-[var(--brand)] underline-offset-2 hover:underline"
          >
            返回软件产品
          </DocsLink>
        </p>
      </header>
      <DocsHome loggedIn={Boolean(session)} documents={documents} />
    </div>
  );
}
