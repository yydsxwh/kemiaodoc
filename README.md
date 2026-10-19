# 科苗文档

本草稿已按当前主站 3686fed59ecbc650157d096733db98954f418a06 重做，具有单独 Next.js 进程、产品路由、健康接口与数据库配置。身份通过 Account OIDC；不提供本地密码登录或演示种子。

独立进程端口 4211 只是候选值，上线前核对监听。入口 /products/docs。

npm install
npm run typecheck
npm test
npm run test:host
npm run build

生产切流前必须完成 docs/SPLIT-READINESS.md 的数据、身份和公共能力验收。本 PR 保持草稿，不表示已经部署。
