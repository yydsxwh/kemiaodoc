/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "颗秒文档",
  description: "颗秒文档的访客阅读页。",
};

export { default } from "@andyyyds/docs/routes/products/docs/share/[token]/page";
