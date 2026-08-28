import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/mock-auth";
import { getNotificationsForUser } from "@/lib/mock-notifications";

/**
 * GET /api/notifications
 * Requires a session; intended to be polled every 60s per the cache table.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = getNotificationsForUser(userId);
  return NextResponse.json({ items, total: items.length });
}
