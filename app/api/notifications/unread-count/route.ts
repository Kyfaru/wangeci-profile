import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** GET /api/notifications/unread-count : cheap count for the bell (polled every 60 seconds). */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const count = await prisma.notificationLog.count({ where: { userId: session.user.id, channel: "IN_APP", readAt: null } });
  return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
}
