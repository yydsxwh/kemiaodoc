/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "颗秒文档",
  description: "颗秒文档：编辑、目录、知识库和分享。",
};

export { default } from "@andyyyds/docs/routes/products/docs/[id]/page";
