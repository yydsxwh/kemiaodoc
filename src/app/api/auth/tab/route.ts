import { NextResponse } from "next/server";
import { updateWwwTab } from "@andyyyds/shared/www-tab-broker";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { op?: string; role?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  if (body.op !== "logout-tab" && body.op !== "role") {
    return NextResponse.json({ error: "不支持的操作" }, { status: 400 });
  }
  const result = await updateWwwTab({ op: body.op, role: body.role });
  return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
}
