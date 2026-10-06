import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";

/** GET /api/notifications: signed-in users only. Phase 4 reads IN_APP rows from notification_log. */
export async function GET() {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: [], total: 0 });
}
