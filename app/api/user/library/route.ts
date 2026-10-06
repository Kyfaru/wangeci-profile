import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";

/** GET /api/user/library: signed-in users only. Phase 4 returns real Entitlement rows. */
export async function GET() {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: [], total: 0 });
}
