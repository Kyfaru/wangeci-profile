import { NextResponse } from "next/server";

import { findOrderForViewer, ORDER_TOKEN_HEADER } from "@/lib/orders/access";
import { reconcilePendingOrder } from "@/lib/orders/apply-event";
import { maskEmail, maskPhone } from "@/lib/phone";
import { rateLimit } from "@/lib/rate-limit";
import { api, logError } from "@/lib/trace";

export const dynamic = "force-dynamic";

/** Wait this long for the webhook before asking the provider ourselves. */
const FALLBACK_AFTER_MS = 15_000;

/**
 * GET /api/orders/[id] (token in the x-order-token header): the buyer's own order. The signed-in owner, or
 * the device that paid (it holds the secret token), can see it; only the owner sees the account's full
 * name, email and phone. Everyone else gets 404. The thank-you page and the payment
 * modal poll this. If the order is still PENDING after a short wait, the server asks the provider
 * directly (verify) and runs the same idempotent grant, which protects against a delayed or missed
 * webhook. The browser is never a witness: only the server-side result is shown.
 */
async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = request.headers.get(ORDER_TOKEN_HEADER);

  let found = await findOrderForViewer(id, token);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 }); // not yours looks the same as not there

  if (found.order.status === "PENDING" && Date.now() - found.order.createdAt.getTime() > FALLBACK_AFTER_MS && (await rateLimit(`order-verify:${found.order.id}`, 6, "1 m")).ok) {
    try {
      await reconcilePendingOrder(found.order.id);
      found = (await findOrderForViewer(id, token)) ?? found;
    } catch (error) {
      logError("orders.status-fallback", error, { orderId: found.order.id }); // keep showing PENDING; the cron sweep will retry
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
    buyer: signedIn
      ? { name: order.user.name, email: order.user.email, phone: order.user.phoneNumber }
      : { name: order.user.name.split(" ")[0] ?? "", email: maskEmail(order.user.email), phone: maskPhone(order.payerPhone) },
    refundPending: Boolean(order.refundRequestedAt) && order.status === "PAID",
    items: order.items.map((i) => ({ title: i.edition.title ?? i.edition.work.title, slug: i.edition.work.slug, price: Number(i.unitPrice) })),
  });
}

export const GET = api("orders.id.get", handleGET);
