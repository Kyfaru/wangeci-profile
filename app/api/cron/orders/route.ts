import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { reconcilePendingOrder } from "@/lib/orders/apply-event";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function authorised(request: Request): boolean {
  const expected = env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /i, "") ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * GET /api/cron/orders : scheduled housekeeping, guarded by CRON_SECRET (Vercel cron on staging, a
 * Coolify scheduled task in production). Everything here is idempotent, so running it twice is harmless.
 *  1. Ask the provider about orders still PENDING after 2 minutes (catches a missed webhook).
 *  2. Mark orders PENDING for more than 24 hours as EXPIRED.
 *  3. Delete contact-form bell items older than 90 days.
 */
export async function GET(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = Date.now();
  const stuck = await prisma.order.findMany({
    where: { status: "PENDING", providerReference: { not: null }, createdAt: { lt: new Date(now - 2 * MIN), gt: new Date(now - DAY) } },
    select: { id: true },
    take: 25,
    orderBy: { createdAt: "asc" },
  });
  const outcomes: Record<string, number> = {};
  for (const { id } of stuck) {
    try {
      const result = await reconcilePendingOrder(id);
      outcomes[result] = (outcomes[result] ?? 0) + 1;
    } catch (error) {
      console.error("[cron] reconcile failed", id, error);
      outcomes.error = (outcomes.error ?? 0) + 1;
    }
  }

  const expired = await prisma.order.updateMany({ where: { status: "PENDING", createdAt: { lt: new Date(now - DAY) } }, data: { status: "EXPIRED", failureReason: "expired_unpaid" } });
  const purged = await prisma.notificationLog.deleteMany({ where: { channel: "IN_APP", purpose: "contact_message", createdAt: { lt: new Date(now - 90 * DAY) } } });

  return NextResponse.json({ checked: stuck.length, outcomes, expired: expired.count, purgedMessages: purged.count });
}
