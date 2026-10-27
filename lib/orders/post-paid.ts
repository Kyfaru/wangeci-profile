import { createElement } from "react";

import ReceiptEmail from "@/emails/receipt-email";
import { sendEmail } from "@/lib/email";
import { buildInvoicePdf } from "@/lib/invoice/pdf";
import { maskEmail, maskPhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/server/notifier";
import { notifyAdmins } from "@/lib/server/notify-admins";
import { sendSms } from "@/lib/sms";
import { AppError, logError } from "@/lib/trace";
import { orderWelcome } from "@/lib/sms-templates";
import { SITE } from "@/lib/site";

const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-KE")}`;

/**
 * Builds the invoice for an order that is already PAID. Shared by the email and the download route.
 * `full` is true only for the account owner (and the email that goes to their own address); a device that
 * merely holds the order token gets first name and masked contact details, never the account's PII.
 */
export async function invoiceForOrder(orderId: string, { full }: { full: boolean }) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, name: true, email: true, phoneNumber: true } }, coupon: { select: { code: true } }, items: { include: { edition: { include: { work: true } } } } },
  });
  if (!order || order.status !== "PAID" || !order.invoiceNumber) return null;
  const bytes = await buildInvoicePdf({
    invoiceNumber: order.invoiceNumber,
    paidAt: order.paidAt ?? order.updatedAt,
    currency: order.currency,
    buyerName: full ? order.user.name : (order.user.name.split(" ")[0] ?? ""),
    buyerEmail: full ? order.user.email : maskEmail(order.user.email),
    buyerPhone: full ? (order.payerPhone ?? order.user.phoneNumber) : maskPhone(order.payerPhone ?? order.user.phoneNumber),
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
 * A buyer who already held one of these editions (from ANOTHER order, or complimentary access) has paid twice.
 * The order stays PAID (the money is real and the provider says so); a person must refund one of the two.
 */
async function alertIfPaidTwice(order: { id: string; userId: string; items: { editionId: string }[] }) {
  const held = await prisma.entitlement.findMany({
    where: { userId: order.userId, editionId: { in: order.items.map((i) => i.editionId) }, OR: [{ orderId: null }, { orderId: { not: order.id } }] },
    select: { editionId: true, orderId: true },
  });
  if (held.length === 0) return;
  const body = `Order ${order.id} was paid, but the buyer already had access to ${held.length} of its books (from order ${held.map((h) => h.orderId ?? "complimentary access").join(", ")}). Check Paystack / M-Pesa and refund one.`;
  logError("orders.duplicate-payment", new AppError("ORDER_DUPLICATE_PAYMENT", body, 500), { orderId: order.id });
  await notifyAdmins({ type: "duplicate_payment", title: "Possible double payment", body, link: `/admin/sales/${order.id}`, dedupeKey: `duplicate-payment:${order.id}`, urgent: true });
}

/**
 * Everything that follows a payment, run ONCE (only the call that really moved the order to PAID gets here).
 * Each step is independent and none of them can undo or fail the payment.
 */
export async function afterOrderPaid(orderId: string): Promise<void> {
  const built = await invoiceForOrder(orderId, { full: true }).catch((error) => {
    logError("post-paid.invoice", error, { orderId });
    return null;
  });
  const order = built?.order ?? (await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, coupon: { select: { code: true } }, items: { include: { edition: { include: { work: true } } } } } }));
  if (!order) return;

  const user = order.user;
  const titles = order.items.map((i) => i.edition.title ?? i.edition.work.title);
  const total = money(Number(order.totalAmount), order.currency);
  const dashboardUrl = `${SITE.url}/dashboard`;
  // A free order (100% coupon) costs the sender nothing, so it must not be a way to text an unverified number.
  const mayText = Number(order.totalAmount) > 0 || Boolean((await prisma.user.findUnique({ where: { id: user.id }, select: { phoneNumberVerified: true } }))?.phoneNumberVerified);
  const smsTo = mayText ? (user.phoneNumber ?? (order.accountCreated ? order.payerPhone : null)) : null;

  await Promise.allSettled([
    sendEmail({
      to: user.email,
      subject: "Your Wangeci order is confirmed",
      react: createElement(ReceiptEmail, { titles, total, reference: order.providerReference ?? order.id, invoiceNumber: order.invoiceNumber ?? undefined, email: user.email, phone: user.phoneNumber, dashboardUrl, signInUrl: `${SITE.url}/sign-in` }),
      attachments: built ? [{ filename: `${order.invoiceNumber}.pdf`, content: Buffer.from(built.bytes) }] : undefined,
      userId: user.id,
      purpose: "order-paid",
    }),
    // A guest-created account has no phone on file until one is verified, so its welcome goes to the number
    // given at checkout (kept on the order). An existing account only ever gets texts on its own number.
    smsTo ? sendSms({ to: smsTo, message: orderWelcome(dashboardUrl), userId: user.id, purpose: "order-paid" }) : Promise.resolve(),
    notify(user.id, { type: "order_paid", orderId: order.id, titles, total, reference: order.providerReference ?? order.id }),
    notifyAdmins({ type: "order_paid", title: "New paid order", body: `${titles.join(", ")} for ${total}${order.accountCreated ? " (new customer)" : ""}`, link: `/admin/sales/${order.id}`, dedupeKey: `order-paid:${order.id}` }),
    alertIfPaidTwice(order),
    prisma.cartItem.deleteMany({ where: { cart: { userId: user.id }, editionId: { in: order.items.map((i) => i.editionId) } } }),
  ]).then((results) => results.forEach((r) => r.status === "rejected" && logError("post-paid.step", r.reason, { orderId })));
}
