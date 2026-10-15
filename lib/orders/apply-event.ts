
import { markOrderPaid } from "@/lib/orders/grant";
import { afterOrderPaid } from "@/lib/orders/post-paid";
import { getProvider } from "@/lib/payments";
import type { ProviderEvent, ProviderId } from "@/lib/payments/types";
import { prisma } from "@/lib/prisma";
import { findOwnerId, recordAudit } from "@/lib/server/audit";
import { notify } from "@/lib/server/notifier";
import { notifyAdmins } from "@/lib/server/notify-admins";
import { AppError, logError } from "@/lib/trace";

export type ApplyResult =
  | "granted" // the order was moved to PAID and the books granted now
  | "noop" // already processed, unknown reference, or nothing to do
  | "mismatch" // amount or currency differs from the order: nothing granted
  | "failed" // the payment failed; order marked FAILED
  | "refunded" // refund completed; access removed
  | "refund_failed"
  | "dispute_opened" // order flagged, admins alerted; access untouched
  | "dispute_resolved";

/**
 * Applies ONE normalised provider event. Webhooks, the checkout status fallback and the cron sweep all
 * call this, and it is safe to call any number of times with the same event.
 * Never throws for "cannot fix by retrying" cases (unknown reference, mismatch): it records them and
 * returns, so the webhook can answer 200. It DOES throw when the database is down, so the provider retries.
 */
export async function applyProviderEvent(event: ProviderEvent): Promise<ApplyResult> {
  switch (event.type) {
    case "payment.succeeded":
      return onPaymentSucceeded(event);
    case "payment.failed":
      return onPaymentFailed(event);
    case "refund.processed":
      return onRefundProcessed(event);
    case "refund.failed":
      return onRefundFailed(event);
    case "dispute.opened":
    case "dispute.resolved":
      return onDispute(event);
    default:
      return "noop";
  }
}

async function onPaymentSucceeded(event: Extract<ProviderEvent, { type: "payment.succeeded" }>): Promise<ApplyResult> {
  const order = await prisma.order.findUnique({ where: { providerReference: event.reference }, include: { items: { include: { edition: { include: { work: true } } } } } });
  if (!order) {
    logError("orders.unknown-reference", new AppError("ORDER_NOT_FOUND", "payment event for an unknown reference", 404), { reference: event.reference });
    return "noop";
  }
  if (order.provider !== event.provider) return "noop";
  if (order.status === "PAID" || order.status === "REFUNDED") return "noop";

  // 1. The amount and currency must match what WE put on the order (never what the browser said).
  const expectedMinor = Math.round(Number(order.totalAmount) * 100);
  if (event.currency !== order.currency || Math.round(event.amount * 100) !== expectedMinor) {
    await raiseMismatch(order.id, order.totalAmount.toString(), order.currency, event);
    return "mismatch";
  }

  // 2. M-Pesa callbacks are unsigned, so confirm with Safaricom directly before trusting them.
  if (event.provider === "MPESA") {
    const confirmed = await getProvider("MPESA").verify(event.reference).catch((error) => {
      logError("orders.mpesa-confirm", error, { orderId: order.id });
      throw error; // cannot confirm right now: let the caller retry later
    });
    if (confirmed.state !== "success") return "noop";
  }

  // 3. One atomic, conditional step: status change and entitlements together.
  const granted = await prisma.$transaction((tx) => markOrderPaid(order.id, { provider: event.provider, receipt: event.receipt, payerPhone: event.payerPhone }, tx));
  if (!granted) return "noop";

  // 4. After the commit: invoice, email, SMS and admin alerts. Failures here must never undo or fail the payment.
  await afterOrderPaid(order.id).catch((error) => logError("orders.post-paid", error, { orderId: order.id }));
  return "granted";
}

async function raiseMismatch(orderId: string, expected: string, currency: string, event: Extract<ProviderEvent, { type: "payment.succeeded" }>) {
  const message = `Payment amount mismatch on order ${orderId}: expected ${currency} ${expected}, provider reported ${event.currency} ${event.amount} (${event.provider} ${event.reference}). No access granted.`;
  logError("orders.amount-mismatch", new AppError("ORDER_AMOUNT_MISMATCH", message, 500), { orderId });
  await prisma.order.update({ where: { id: orderId }, data: { failureReason: "amount_mismatch" } }).catch((e) => logError("orders.mismatch-flag", e, { orderId }));
  await notifyAdmins({ type: "payment_mismatch", title: "Payment amount mismatch", body: message, link: `/admin/sales/${orderId}`, dedupeKey: `mismatch:${orderId}`, urgent: true }).catch((e) => logError("orders.admin-alert", e, { orderId }));
}

async function onPaymentFailed(event: Extract<ProviderEvent, { type: "payment.failed" }>): Promise<ApplyResult> {
  // Only a still-PENDING order can fail. A PAID order is never downgraded by a late "failed" message.
  const { count } = await prisma.order.updateMany({
    where: { providerReference: event.reference, provider: event.provider, status: "PENDING" },
    data: { status: "FAILED", failureReason: event.reason?.slice(0, 200) ?? "payment_failed" },
  });
  return count > 0 ? "failed" : "noop";
}

/** Finds the order a refund event is about, but only if WE asked for that refund. */
async function refundTarget(event: { provider: ProviderId; reference: string }) {
  return prisma.order.findFirst({
    where: { providerReference: event.reference, provider: event.provider, status: "PAID", refundRequestedAt: { not: null } },
    include: { items: { include: { edition: { include: { work: true } } } } },
  });
}

async function onRefundProcessed(event: Extract<ProviderEvent, { type: "refund.processed" }>): Promise<ApplyResult> {
  const order = await refundTarget(event);
  if (!order) return "noop";

  const actor = order.refundRequestedById ?? (await findOwnerId());
  const done = await prisma.$transaction(async (tx) => {
    // Conditional: only a PAID order can become REFUNDED, exactly once.
    const { count } = await tx.order.updateMany({ where: { id: order.id, status: "PAID" }, data: { status: "REFUNDED" } });
    if (count === 0) return false;
    // Remove access that THIS order granted (complimentary access has no order id and is untouched).
    await tx.entitlement.deleteMany({ where: { orderId: order.id } });
    if (actor) await recordAudit({ adminId: actor, action: "refund.completed", targetType: "order", targetId: order.id, meta: { reference: event.reference } }, tx);
    return true;
  });
  if (!done) return "noop";

  const titles = order.items.map((i) => i.edition.title ?? i.edition.work.title);
  await Promise.allSettled([notify(order.userId, { type: "refund_completed", orderId: order.id, titles })]);
  return "refunded";
}

async function onRefundFailed(event: Extract<ProviderEvent, { type: "refund.failed" }>): Promise<ApplyResult> {
  const order = await refundTarget(event);
  if (!order) return "noop";
  const actor = order.refundRequestedById ?? (await findOwnerId());
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: order.id }, data: { refundRequestedAt: null, refundRequestedById: null } });
    if (actor) await recordAudit({ adminId: actor, action: "refund.failed", targetType: "order", targetId: order.id, meta: { reference: event.reference } }, tx);
  });
  await notifyAdmins({ type: "refund_failed", title: "Refund failed", body: `The provider could not refund order ${order.id}. The order is unchanged.`, link: `/admin/sales/${order.id}`, dedupeKey: `refund-failed:${order.id}`, urgent: true }).catch((e) => logError("orders.admin-alert", e, { orderId: order.id }));
  return "refund_failed";
}

// A chargeback is for a person to decide on, so we flag and alert but never revoke access ourselves.
// failureReason doubles as the flag (no schema change); the conditional update makes the audit row once-only.
const DISPUTE_OPEN = "dispute_open";

async function onDispute(event: Extract<ProviderEvent, { type: "dispute.opened" | "dispute.resolved" }>): Promise<ApplyResult> {
  const order = await prisma.order.findFirst({ where: { providerReference: event.reference, provider: event.provider, status: "PAID" }, select: { id: true } });
  if (!order) {
    logError("orders.dispute-unknown-reference", new AppError("ORDER_NOT_FOUND", "dispute event for an unknown or unpaid reference", 404), { reference: event.reference });
    return "noop";
  }
  const opened = event.type === "dispute.opened";
  const flag = opened ? DISPUTE_OPEN : `dispute_resolved:${event.resolution ?? "unknown"}`.slice(0, 200);
  const actor = await findOwnerId();

  await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({ where: { id: order.id, OR: [{ failureReason: null }, { failureReason: { not: flag } }] }, data: { failureReason: flag } });
    if (count > 0 && actor) await recordAudit({ adminId: actor, action: opened ? "dispute.opened" : "dispute.resolved", targetType: "order", targetId: order.id, meta: { reference: event.reference, ...(opened ? {} : { resolution: event.resolution ?? null }) } }, tx);
  });

  // Outside the transaction and not swallowed: if the alert fails the webhook is retried, and dedupeKey
  // keeps the retry from creating a second one.
  await notifyAdmins({
    type: opened ? "payment_dispute" : "payment_dispute_resolved",
    title: opened ? "Card dispute opened" : "Card dispute resolved",
    body: opened
      ? `A customer disputed the card payment for order ${order.id}. Access was NOT removed: review it in the Paystack dashboard.`
      : `The card dispute for order ${order.id} was resolved (${event.resolution ?? "no resolution given"}). Access is unchanged.`,
    link: `/admin/sales/${order.id}`,
    dedupeKey: `${opened ? "dispute" : "dispute-resolved"}:${order.id}`,
    urgent: opened,
  });
  return opened ? "dispute_opened" : "dispute_resolved";
}

/**
 * Asks the provider what really happened to a PENDING order and applies the answer. Used by the
 * checkout status fallback (a delayed or missed webhook) and by the cron sweep. Safe to repeat.
 */
export async function reconcilePendingOrder(orderId: string): Promise<ApplyResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== "PENDING" || !order.provider || !order.providerReference) return "noop";

  const provider = getProvider(order.provider);
  const result = await provider.verify(order.providerReference);
  if (result.state === "success") {
    return applyProviderEvent({
      type: "payment.succeeded",
      provider: order.provider,
      reference: order.providerReference,
      // M-Pesa's query returns no amount: the STK request was for exactly the order total.
      amount: result.amount ?? Number(order.totalAmount),
      currency: result.currency ?? order.currency,
    });
  }
  if (result.state === "failed") return applyProviderEvent({ type: "payment.failed", provider: order.provider, reference: order.providerReference, reason: result.reason });
  return "noop";
}
