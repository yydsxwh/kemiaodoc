import type {ReactNode} from "react";
import Link from "next/link";
import Script from "next/script";
import {LocaleProvider} from "@/components/i18n/locale-provider";
import "./globals.css";
export const dynamic="force-dynamic";
export const metadata={title:"科苗文档"};
export default function Layout({children}:{children:ReactNode}) { return <html lang="zh-CN"><body><Script src="/api/tab-bootstrap" strategy="beforeInteractive"/><LocaleProvider locale="zh-Hans" bilingual={false}><header className="container py-4 flex gap-4"><Link href="/products/docs">科苗文档</Link><Link href="/products/docs">管理</Link><Link href="/login">登录</Link></header><main>{children}</main></LocaleProvider></body></html>; }
