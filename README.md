# 科苗文档

本草稿已按当前主站 3686fed59ecbc650157d096733db98954f418a06 重做，具有单独 Next.js 进程、产品路由、健康接口与数据库配置。身份通过 Account OIDC；不提供本地密码登录或演示种子。

独立进程端口 4211 只是候选值，上线前核对监听。入口 /products/docs。

npm install
npm run typecheck
npm test
npm run test:host
npm run build

生产切流前必须完成 docs/SPLIT-READINESS.md 的数据、身份和公共能力验收。本 PR 保持草稿，不表示已经部署。

## 主站入口与日事兼容

主分支记录的网页文档入口由 `yydsxwh/Andyyyds` 的 `packages/docs` 提供，与主站同进程。日事把便签导出成 Word 或送进网页文档时可调用主站的 `/api/docs`。此能力是可选的，调用失败不影响日事便签。

## Cursor 开发任务

- [2026-11-05：飞书式图文阅读、章节目录、知识库导航与网页分享](docs/cursor-tasks/2026-11-05-feishu-style-wiki-navigation.md) — 已编写，待 Cursor 执行。任务正文保存在本仓库；实际业务代码修改位置为 `yydsxwh/Andyyyds/packages/docs`，执行后在任务内回填实现、测试和部署证据。

单产品任务沿用 `docs/cursor-tasks/`，避免多份需求正文分叉。提交任务文件不表示功能已实现或已上线。
