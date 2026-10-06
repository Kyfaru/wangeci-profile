import { Prisma } from "@prisma/client";

import type { TimeRange } from "@/lib/admin/time-range";
import { getKv } from "@/lib/auth/kv";
import { prisma } from "@/lib/prisma";

/** Reuse a computed result for a short while (30 to 300 seconds, set by the range). Shared across servers when Redis is configured. */
async function cached<T>(key: string, seconds: number, compute: () => Promise<T>): Promise<T> {
  const kv = getKv();
  const hit = await kv.get<T>(`admin-stats:${key}`);
  if (hit) return hit;
  const value = await compute();
  await kv.set(`admin-stats:${key}`, value, seconds);
  return value;
}

export interface Overview {
  from: string;
  to: string;
  unit: string;
  currency: string;
  /** PAID orders only: refunded orders drop out, and complimentary access has no order so it never counts. */
  paidOrders: number;
  revenue: number;
  /** Accounts that hold a valid session right now. Honest label: "has a valid session", not "online". */
  signedInAccounts: number;
  /** Distinct people whose reading or listening position was saved in the range. */
  activeReaders: number;
  perEdition: { editionId: string; title: string; format: string; bought: number; revenue: number }[];
  progress: { editionId: string; title: string; started: number; finished: number; averagePct: number }[];
  series: { bucket: string; orders: number; revenue: number }[];
  latestOrders: { id: string; buyer: string; total: number; currency: string; status: string; createdAt: string }[];
}

const FINISHED_AT = 98;

export function getOverview(range: TimeRange): Promise<Overview> {
  return cached(`overview:${range.key}`, range.cacheSeconds, async () => {
    const paidWhere = { status: "PAID" as const, paidAt: { gte: range.start, lt: range.end } };
    const now = new Date();

    const [paid, signedIn, readers, items, started, finished, series, latest] = await Promise.all([
      prisma.order.aggregate({ where: paidWhere, _count: true, _sum: { totalAmount: true } }),
      prisma.session.findMany({ where: { expiresAt: { gt: now } }, distinct: ["userId"], select: { userId: true } }),
      prisma.readingPosition.findMany({ where: { updatedAt: { gte: range.start, lt: range.end } }, distinct: ["userId"], select: { userId: true } }),
      prisma.orderItem.groupBy({ by: ["editionId"], where: { order: paidWhere }, _count: true, _sum: { unitPrice: true } }),
      prisma.readingPosition.groupBy({ by: ["editionId"], _count: true, _avg: { progressPct: true } }),
      prisma.readingPosition.groupBy({ by: ["editionId"], where: { progressPct: { gte: FINISHED_AT } }, _count: true }),
      prisma.$queryRaw<{ bucket: Date; orders: number; revenue: number }[]>(Prisma.sql`
        SELECT date_trunc(${range.unit}::text, "paidAt" AT TIME ZONE 'Africa/Nairobi') AS bucket,
               count(*)::int AS orders, coalesce(sum("totalAmount"), 0)::float AS revenue
        FROM "order"
        WHERE status = 'PAID' AND "paidAt" >= ${range.start} AND "paidAt" < ${range.end}
        GROUP BY 1 ORDER BY 1`),
      prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { user: { select: { name: true, email: true } } } }),
    ]);

    const editionIds = [...new Set([...items.map((i) => i.editionId), ...started.map((s) => s.editionId)])];
    const editions = await prisma.edition.findMany({ where: { id: { in: editionIds } }, include: { work: { select: { title: true } } } });
    const nameOf = (id: string) => {
      const e = editions.find((x) => x.id === id);
      return { title: e ? (e.title ?? e.work.title) : "Unknown", format: e?.format ?? "" };
    };

    return {
      from: range.start.toISOString(),
      to: range.end.toISOString(),
      unit: range.unit,
      currency: "KES",
      paidOrders: paid._count,
      revenue: Number(paid._sum.totalAmount ?? 0),
      signedInAccounts: signedIn.length,
      activeReaders: readers.length,
      perEdition: items.map((i) => ({ editionId: i.editionId, ...nameOf(i.editionId), bought: i._count, revenue: Number(i._sum.unitPrice ?? 0) })).sort((a, b) => b.bought - a.bought),
      progress: started.map((s) => ({
        editionId: s.editionId,
        title: nameOf(s.editionId).title,
        started: s._count,
        finished: finished.find((f) => f.editionId === s.editionId)?._count ?? 0,
        averagePct: Math.round((s._avg.progressPct ?? 0) * 10) / 10,
      })),
      series: series.map((r) => ({ bucket: new Date(r.bucket).toISOString(), orders: r.orders, revenue: r.revenue })),
      latestOrders: latest.map((o) => ({ id: o.id, buyer: o.user.name || o.user.email, total: Number(o.totalAmount), currency: o.currency, status: o.status, createdAt: o.createdAt.toISOString() })),
    };
  });
}

export interface AttentionItem {
  key: string;
  label: string;
  count: number;
  href: string;
}

/** The "needs attention" panel. Cheap counts, never cached (they must be right when you look). */
export async function getAttention(adminId: string): Promise<AttentionItem[]> {
  const now = Date.now();
  const [mismatch, refundPending, stuck, unread] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING", failureReason: "amount_mismatch" } }),
    prisma.order.count({ where: { status: "PAID", refundRequestedAt: { not: null } } }),
    prisma.order.count({ where: { status: "PENDING", providerReference: { not: null }, createdAt: { lt: new Date(now - 15 * 60_000), gt: new Date(now - 24 * 3_600_000) } } }),
    prisma.notificationLog.count({ where: { userId: adminId, channel: "IN_APP", readAt: null } }),
  ]);
  return [
    { key: "mismatch", label: "Payments with a wrong amount (no access was given)", count: mismatch, href: "/admin/sales?status=PENDING" },
    { key: "refund", label: "Refunds waiting for the provider", count: refundPending, href: "/admin/sales?status=PAID" },
    { key: "stuck", label: "Orders unpaid for over 15 minutes", count: stuck, href: "/admin/sales?status=PENDING" },
    { key: "inbox", label: "Unread messages and alerts", count: unread, href: "/admin/inbox" },
  ].filter((i) => i.count > 0);
}
