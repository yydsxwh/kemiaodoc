import Link from "next/link";
export async function StudioNav(_props:{current?:string;area?:string}) { return <nav className="container py-4 flex gap-4"><Link href="/products/docs">科苗文档</Link><Link href="/products/docs">管理</Link></nav>; }
