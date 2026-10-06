import { createElement } from "react";

import ReceiptEmail from "@/emails/receipt-email";
import { payLadder } from "@/lib/checkout/attempt-ladder";
import { sendEmail } from "@/lib/email";
import { buildInvoicePdf } from "@/lib/invoice/pdf";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/server/notifier";
import { notifyAdmins } from "@/lib/server/notify-admins";
import { sendSms } from "@/lib/sms";
import { orderWelcome } from "@/lib/sms-templates";
import { SITE } from "@/lib/site";

const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-KE")}`;

/** Builds the invoice for an order that is already PAID. Shared by the email and the download route. */
export async function invoiceForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, name: true, email: true, phoneNumber: true } }, coupon: { select: { code: true } }, items: { include: { edition: { include: { work: true } } } } },
  });
  if (!order || order.status !== "PAID" || !order.invoiceNumber) return null;
  const bytes = await buildInvoicePdf({
    invoiceNumber: order.invoiceNumber,
    paidAt: order.paidAt ?? order.updatedAt,
    currency: order.currency,
    buyerName: order.user.name,
    buyerEmail: order.user.email,
    buyerPhone: order.payerPhone ?? order.user.phoneNumber,
    items: order.items.map((i) => ({ title: i.edition.title ?? i.edition.work.title, price: Number(i.unitPrice) })),
    subtotal: Number(order.subtotalAmount) || Number(order.totalAmount),
    discount: Number(order.discountAmount),
    fee: Number(order.feeAmount),
    total: Number(order.totalAmount),
    couponCode: order.coupon?.code ?? null,
    method: order.provider === "PAYSTACK" ? "Card (Paystack)" : order.provider === "MPESA" ? `M-Pesa${order.mpesaReceipt ? ` ${order.mpesaReceipt}` : ""}` : "No payment needed (100% discount)",
    reference: order.providerReference ?? order.id,
  });
  return { bytes, order };
}

/**
 * Everything that follows a payment, run ONCE (only the call that really moved the order to PAID gets here).
 * Each step is independent and none of them can undo or fail the payment.
 */
export async function afterOrderPaid(orderId: string): Promise<void> {
  const built = await invoiceForOrder(orderId).catch((error) => {
    console.error("[post-paid] invoice failed", error);
    return null;
  });
  const order = built?.order ?? (await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, coupon: { select: { code: true } }, items: { include: { edition: { include: { work: true } } } } } }));
  if (!order) return;

  const user = order.user;
  const titles = order.items.map((i) => i.edition.title ?? i.edition.work.title);
  const total = money(Number(order.totalAmount), order.currency);
  const dashboardUrl = `${SITE.url}/dashboard`;

  await Promise.allSettled([
    sendEmail({
      to: user.email,
      subject: "Your Wangeci order is confirmed",
      react: createElement(ReceiptEmail, { titles, total, reference: order.providerReference ?? order.id, invoiceNumber: order.invoiceNumber ?? undefined, email: user.email, phone: user.phoneNumber, dashboardUrl, signInUrl: `${SITE.url}/sign-in` }),
      attachments: built ? [{ filename: `${order.invoiceNumber}.pdf`, content: Buffer.from(built.bytes) }] : undefined,
      userId: user.id,
      purpose: "order-paid",
    }),
    // The number was given at checkout for exactly this message, so it does not need to be verified first.
    user.phoneNumber ? sendSms({ to: user.phoneNumber, message: orderWelcome(dashboardUrl), userId: user.id, purpose: "order-paid" }) : Promise.resolve(),
    notify(user.id, { type: "order_paid", orderId: order.id, titles, total, reference: order.providerReference ?? order.id }, ["in_app"]),
    notifyAdmins({ type: "order_paid", title: "New paid order", body: `${titles.join(", ")} for ${total}${order.accountCreated ? " (new customer)" : ""}`, link: `/admin/sales/${order.id}`, dedupeKey: `order-paid:${order.id}` }),
    payLadder.clear(user.email),
    prisma.cartItem.deleteMany({ where: { cart: { userId: user.id }, editionId: { in: order.items.map((i) => i.editionId) } } }),
  ]).then((results) => results.forEach((r) => r.status === "rejected" && console.error("[post-paid] a step failed", r.reason)));
}
