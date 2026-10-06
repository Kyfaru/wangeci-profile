import type { Prisma } from "@prisma/client";

/**
 * The ONE function that gives a buyer their books. Every payment path (webhook, status check, cron
 * sweep) ends here, and it is idempotent: running it twice leaves exactly one entitlement per edition.
 */
export async function grantOrderEntitlements(orderId: string, tx: Prisma.TransactionClient): Promise<number> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { items: true } });
  for (const item of order.items) {
    await tx.entitlement.upsert({
      where: { userId_editionId: { userId: order.userId, editionId: item.editionId } },
      create: { userId: order.userId, editionId: item.editionId, orderId: order.id },
      update: {}, // already owned (a retry, or complimentary access): nothing to change
    });
  }
  return order.items.length;
}

export interface PaidDetails {
  provider: "PAYSTACK" | "MPESA";
  receipt?: string;
  payerPhone?: string;
}

/**
 * Moves an order to PAID and grants access, as one atomic step.
 * The status change is conditional ("only while still PENDING, FAILED or EXPIRED"), so two webhooks
 * arriving at the same moment cannot both win: the database lets exactly one UPDATE through.
 * FAILED and EXPIRED are included on purpose: if a buyer's money really arrived late, they get the book.
 * Returns false when someone else already processed it.
 */
export async function markOrderPaid(orderId: string, details: PaidDetails, tx: Prisma.TransactionClient): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: { in: ["PENDING", "FAILED", "EXPIRED"] } },
    data: { status: "PAID", paidAt: new Date(), failureReason: null, mpesaReceipt: details.receipt, payerPhone: details.payerPhone },
  });
  if (count === 0) return false;
  await grantOrderEntitlements(orderId, tx);
  return true;
}
