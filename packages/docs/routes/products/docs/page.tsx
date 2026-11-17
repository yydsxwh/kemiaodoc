import Link from "next/link";
import { DocsHome } from "@andyyyds/docs/components/docs-home";
import { NavPageTemplateShell } from "@/components/nav-page-template-shell";
import { getSession } from "@andyyyds/shared/auth";
import { getDocsLibrary } from "@andyyyds/docs/lib/docs-wiki-store";

export default async function DocsIndexPage() {
  const session = await getSession();
  const library = session ? await getDocsLibrary(session.id) : null;

  return (
    <NavPageTemplateShell type="products">
      <div className="container py-10 sm:py-12">
        <header className="mb-8 max-w-2xl">
          <p className="text-sm font-medium text-[var(--brand)]">软件产品 · 颗秒文档</p>
          <h1 className="brand-mark mt-2 text-3xl font-semibold sm:text-4xl">颗秒文档</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)] sm:text-base">
            在浏览器里写图文：标题会自动变成目录，可以放进知识库，也可以把已保存的页面分享给访客阅读。
            列表、编号、页眉页脚、打印和导入导出都还在。手机微信里同样能点、能改。
          </p>
          <p className="mt-2 text-xs">
            <Link href="/products" className="font-medium text-[var(--brand)] underline-offset-2 hover:underline">
              返回软件产品
            </Link>
          </p>
        </header>
        <DocsHome loggedIn={Boolean(session)} library={library} />
      </div>
    </NavPageTemplateShell>
  );
}
