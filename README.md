# 科苗文档

本独立开发候选起于 Andyyyds 3686fed59ecbc650157d096733db98954f418a06，并已复核补齐 f505187112ff82341e4cf5233da071439cbedec3 的产品及必要公共依赖，具有单独 Next.js 进程、产品路由、健康接口与数据库配置。身份通过 Account OIDC；不提供本地密码登录或演示种子。

独立进程端口 4211 只是候选值，上线前核对监听。入口 /products/docs。

npm install
npm run typecheck
npm test
npm run test:host
npm run build

生产切流前必须完成 docs/SPLIT-READINESS.md 的数据、身份和公共能力验收。代码合并不代表生产切流。复核范围、来源和测试见 [2026-11-17 PR 复核](docs/PR-REVIEW-20261117.md)。

## 主站入口与日事兼容

主分支记录的网页文档入口由 `yydsxwh/Andyyyds` 的 `packages/docs` 提供，与主站同进程。日事把便签导出成 Word 或送进网页文档时可调用主站的 `/api/docs`。此能力是可选的，调用失败不影响日事便签。

## Cursor 开发任务

- [2026-11-05：飞书式图文阅读、章节目录、知识库导航与网页分享](docs/cursor-tasks/2026-11-05-feishu-style-wiki-navigation.md) — 代码已部署到主站。任务正文仍在本仓库；运行代码在 `yydsxwh/Andyyyds`，提交 `b2709e7`。登录编辑器和手机微信真机尚未验证。

单产品任务沿用 `docs/cursor-tasks/`，避免多份需求正文分叉。提交任务文件不表示功能已实现或已上线。
