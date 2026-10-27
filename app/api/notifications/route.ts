import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";
import { api } from "@/lib/trace";

export const dynamic = "force-dynamic";

/** GET /api/notifications : the person's own in-app (bell) items, newest first. */
async function handleGET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.notificationLog.findMany({
    where: { userId: session.user.id, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
  return NextResponse.json({ items, total: items.length });
}

const readSchema = z.object({ ids: z.array(z.string().min(1).max(64)).max(100).optional() });

/** POST /api/notifications : mark some (ids) or all of your own items as read. */
async function handlePOST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = readSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { count } = await prisma.notificationLog.updateMany({
    where: { userId: session.user.id, channel: "IN_APP", readAt: null, ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {}) },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ updated: count });
}

export const GET = api("notifications.get", handleGET);
export const POST = api("notifications.post", handlePOST);
