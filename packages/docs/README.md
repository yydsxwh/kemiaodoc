# `@kemiaodoc/docs`

从 [yydsxwh/Andyyyds](https://github.com/yydsxwh/Andyyyds) 的 `@andyyyds/docs` 原样抽出的网页文档包。编辑器、编号方案、页眉页脚、导入导出与云端存储逻辑与线上 [网页文档](https://yydsxwh.com/products/docs) 一致。

本包不再依赖 `@andyyyds/shared`。Prisma 与登录会话由宿主注入。

## 给其他产品用

浏览器里只做草稿时，直接引用组件即可：

```tsx
import { DocsEditor, emptyLocalDocument } from "@kemiaodoc/docs"
import "@kemiaodoc/docs/styles.css"

<DocsEditor initial={emptyLocalDocument()} loggedIn={false} />
```

需要云端文档时，在服务端启动处注入：

```ts
import { setDocsGetSession, setDocsPrisma } from "@kemiaodoc/docs"

setDocsPrisma(prisma) // 需有 docsDocument 表，字段与 Andyyyds 一致
setDocsGetSession(async () => {
  const session = await yourAuth()
  return session ? { id: session.userId } : null
})
```

Next.js 宿主可复制本包内的示例：

- 页面：`routes/products/docs/**`
- 接口：`api/docs/**`（`GET/POST /api/docs`、`GET/PATCH/DELETE /api/docs/[id]`、导入导出）

路由默认仍是 `/products/docs`，可用 `homeHref` / `localHref` / `loginHref` 改掉。跳转默认用 `window.location`；要接 React Router 或 Next `useRouter`，调用 `setDocsNavigate`。

## 与 `@kemiaodoc/editor` 的关系

`@kemiaodoc/editor` + `@kemiaodoc/core` + `@kemiaodoc/docx` 是同一套能力的可发布封装（适配器、Vite demo）。`@kemiaodoc/docs` 是 Andyyyds 源码本身，方便对照和按原路径接入。
