import { NextResponse } from "next/server";

import { findOrderForViewer } from "@/lib/orders/access";
import { reconcilePendingOrder } from "@/lib/orders/apply-event";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Wait this long for the webhook before asking the provider ourselves. */
const FALLBACK_AFTER_MS = 15_000;

const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");
const maskPhone = (p: string | null) => (p ? `${p.slice(0, 4)}***${p.slice(-3)}` : null);

/**
 * GET /api/orders/[id]?t=token : the buyer's own order. The signed-in owner, or the device that paid
 * (it holds the secret token), can see it. Everyone else gets 404. The thank-you page and the payment
 * modal poll this. If the order is still PENDING after a short wait, the server asks the provider
 * directly (verify) and runs the same idempotent grant, which protects against a delayed or missed
 * webhook. The browser is never a witness: only the server-side result is shown.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t");

  let found = await findOrderForViewer(id, token);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 }); // not yours looks the same as not there

  if (found.order.status === "PENDING" && Date.now() - found.order.createdAt.getTime() > FALLBACK_AFTER_MS && (await rateLimit(`order-verify:${found.order.id}`, 6, "1 m")).ok) {
    try {
      await reconcilePendingOrder(found.order.id);
      found = (await findOrderForViewer(id, token)) ?? found;
    } catch (error) {
      console.error("[orders] status fallback failed", error); // keep showing PENDING; the cron sweep will retry
    }
  }

  const { order, signedIn } = found;
  return NextResponse.json({
    id: order.id,
    status: order.status,
    provider: order.provider,
    total: Number(order.totalAmount),
    subtotal: Number(order.subtotalAmount) || Number(order.totalAmount),
    discount: Number(order.discountAmount),
    fee: Number(order.feeAmount),
    couponCode: order.coupon?.code ?? null,
    currency: order.currency,
    failureReason: order.failureReason,
    invoiceNumber: order.invoiceNumber,
    signedIn,
    // True while this device may still claim the new account's session (see /api/auth/checkout/claim).
    claimable: order.status === "PAID" && order.accountCreated && !order.claimedAt && !signedIn,
    accountCreated: order.accountCreated,
    buyer: { name: order.user.name, email: signedIn || token ? order.user.email : maskEmail(order.user.email), phone: signedIn || token ? order.user.phoneNumber : maskPhone(order.user.phoneNumber) },
    refundPending: Boolean(order.refundRequestedAt) && order.status === "PAID",
    items: order.items.map((i) => ({ title: i.edition.title ?? i.edition.work.title, slug: i.edition.work.slug, price: Number(i.unitPrice) })),
  });
}
