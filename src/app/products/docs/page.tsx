/** Next.js 路由入口（网址不变）。segment 配置必须写在本文件。 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "颗秒文档",
  description:
    "颗秒文档：标题目录、知识库、图文阅读和访客分享。可打开/另存文件，设置页眉页脚页码并打印。",
};

export { default } from "@andyyyds/docs/routes/products/docs/page";
