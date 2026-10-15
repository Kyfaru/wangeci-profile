import type { Prisma } from "@prisma/client";

interface PaidDetails {
  /** Absent for a free order (a 100% coupon): no provider was involved. */
  provider?: "PAYSTACK" | "MPESA";
  receipt?: string;
  payerPhone?: string;
}

/**
 * Moves an order to PAID and grants access, as one atomic step. This is the ONE function that gives a buyer
 * their books: every payment path (webhook, status check, cron sweep) ends here.
 * The status change is conditional ("only while still PENDING, FAILED or EXPIRED"), so two webhooks
 * arriving at the same moment cannot both win: the database lets exactly one UPDATE through.
 * FAILED and EXPIRED are included on purpose: if a buyer's money really arrived late, they get the book.
 * Entitlements are inserted with skipDuplicates: a book the buyer already owns (a retry, complimentary
 * access, or another order that paid for it) is left as it is. afterOrderPaid raises the alert for the
 * other-order case, because that buyer has paid twice and a person must refund one.
 * Returns false when someone else already processed it.
 */
export async function markOrderPaid(orderId: string, details: PaidDetails, tx: Prisma.TransactionClient): Promise<boolean> {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: { in: ["PENDING", "FAILED", "EXPIRED"] } },
    data: { status: "PAID", paidAt: new Date(), failureReason: null, mpesaReceipt: details.receipt, payerPhone: details.payerPhone },
  });
  if (count === 0) return false;

  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { userId: true, couponId: true, items: { select: { editionId: true } } } });
  await tx.entitlement.createMany({ data: order.items.map((i) => ({ userId: order.userId, editionId: i.editionId, orderId })), skipDuplicates: true });

  // Sequential invoice number (INV-2026-000123), taken from a database sequence inside the same transaction.
  const [{ n }] = await tx.$queryRaw<{ n: bigint }[]>`SELECT nextval('invoice_number_seq') AS n`;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;
  await tx.order.update({ where: { id: orderId }, data: { invoiceNumber } });
  if (order.couponId) await tx.coupon.update({ where: { id: order.couponId }, data: { timesRedeemed: { increment: 1 } } });
  return true;
}
