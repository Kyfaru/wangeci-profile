import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";

export async function GET() {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ count: 0 });
}
