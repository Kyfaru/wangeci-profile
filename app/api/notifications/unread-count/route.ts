import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/mock-auth";
import { getUnreadCountForUser } from "@/lib/mock-notifications";

/**
 * GET /api/notifications/unread-count
 * Requires a session; a lightweight endpoint for a notification-bell badge
 * that can be polled more cheaply than the full notifications list.
 */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ count: getUnreadCountForUser(userId) });
}
