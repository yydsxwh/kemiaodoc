# 科苗文档（kemiaodoc）

从 [歪歪滴艾斯](https://yydsxwh.com/products/docs)（andyyyds）的「网页文档」抽出的**公共文档编辑产品**。其他站点、后台、课程或会议产品可以按包引用，不必再复制一份编辑器。

## 能做什么

和线上网页文档同一套能力：

- 标题、正文、加粗、一到六级标题
- 项目符号 / 项目编号，Tab 升降级
- 可自定义的多级编号（标准 `1. / 1.1.`、中文 `一、（一）`、章节 `第1章`、括号 `(1)`）
- 插图、简单表格
- 打开 Word / HTML / Markdown / 纯文本
- 另存为 Word、HTML、纯文本
- 页眉页脚页码、打印预览（含微信提示）
- 浏览器草稿（localStorage）和云端适配器（`POST/PATCH/DELETE /api/docs`）

## 包结构

| 包 | 用途 |
| --- | --- |
| `@kemiaodoc/core` | 文档 JSON 模型、消毒、编号样式、页眉页脚、HTML/文本转换 |
| `@kemiaodoc/editor` | React 编辑器、工具栏、打印预览、本地/HTTP 存储适配 |
| `@kemiaodoc/docx` | Word 导入（mammoth）与导出（docx） |
| `@kemiaodoc/demo` | 可运行的公共产品演示 |

## 其他产品怎么引用

在 monorepo 里：

```json
{
  "dependencies": {
    "@kemiaodoc/editor": "workspace:*",
    "@kemiaodoc/docx": "workspace:*"
  }
}
```

或发布到 npm / 直接 git 依赖后：

```tsx
import { DocsEditor, DocsWorkspace, createLocalStorageAdapter } from "@kemiaodoc/editor"
import { exportDocx, importDocx } from "@kemiaodoc/docx"
import "@kemiaodoc/editor/styles.css"

const storage = createLocalStorageAdapter()

<DocsEditor
  initial={doc}
  storage={storage}
  docx={{ importFile: (file) => importDocx(file, file.name), exportFile: exportDocx }}
/>
```

对接歪歪滴艾斯现有后端时，用 HTTP 适配器即可（路径与线上一致）：

```ts
import { createHttpAdapter } from "@kemiaodoc/editor"

const api = createHttpAdapter({ baseUrl: "https://yydsxwh.com" })
```

浏览器草稿默认写 `kemiaodoc-local-v1`。若要从 andyyyds 旧草稿迁移，适配器会自动读取 `yyds-docs-local-v1`。

## 本地开发

```bash
pnpm install
pnpm test
pnpm --filter @kemiaodoc/demo dev
```

演示默认在 `http://localhost:5173`。

## 来源

编辑器行为按 `https://yydsxwh.com/products/docs/local` 的网页文档实现移植：文档模型、编号 CSS、页眉页脚、导入导出和工具栏与线上产品对齐，并改成可发布的 TypeScript 公共包，方便颗秒系列及其他产品复用。
