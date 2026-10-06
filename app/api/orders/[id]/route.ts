import { NextResponse } from "next/server";

import { reconcilePendingOrder } from "@/lib/orders/apply-event";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Wait this long for the webhook before asking the provider ourselves. */
const FALLBACK_AFTER_MS = 15_000;

const include = { items: { include: { edition: { include: { work: { select: { title: true, slug: true } } } } } } } as const;

/**
 * GET /api/orders/[id] : the buyer's own order (by order id or payment reference). Nobody else can see it.
 * The thank-you page polls this. If the order is still PENDING after a short wait, the server asks the
 * provider directly (verify) and runs the same idempotent grant, which protects against a delayed or
 * missed webhook. The browser is never a witness: only the server-side result is shown.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let order = await prisma.order.findFirst({ where: { userId: session.user.id, OR: [{ id }, { providerReference: id }] }, include });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 }); // not yours looks the same as not there

  if (order.status === "PENDING" && Date.now() - order.createdAt.getTime() > FALLBACK_AFTER_MS && (await rateLimit(`order-verify:${order.id}`, 6, "1 m")).ok) {
    try {
      await reconcilePendingOrder(order.id);
      order = (await prisma.order.findUnique({ where: { id: order.id }, include })) ?? order;
    } catch (error) {
      console.error("[orders] status fallback failed", error); // keep showing PENDING; the cron sweep will retry
    }
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    provider: order.provider,
    total: Number(order.totalAmount),
    currency: order.currency,
    refundPending: Boolean(order.refundRequestedAt) && order.status === "PAID",
    items: order.items.map((i) => ({ title: i.edition.title ?? i.edition.work.title, slug: i.edition.work.slug, price: Number(i.unitPrice) })),
  });
}
