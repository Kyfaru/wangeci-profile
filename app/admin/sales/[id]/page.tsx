import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { manualRefundAction, refundOrderAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const money = (n: unknown, c: string) => `${c} ${Number(n).toLocaleString("en-KE")}`;
const when = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";

export default async function OrderPage({ params }: PageProps<"/admin/sales/[id]">) {
  const admin = await requireRole("sales.read");
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { coupon: { select: { code: true } }, user: { select: { id: true, name: true, email: true, phoneNumber: true } }, items: { include: { edition: { include: { work: { select: { title: true } } } } } } },
  });
  if (!order) notFound();
  const history = await prisma.auditLog.findMany({ where: { targetType: "order", targetId: order.id }, orderBy: { createdAt: "desc" }, include: { admin: { select: { name: true } } } });

  const canRefund = can(admin.role, "order.refund");
  const refundable = order.status === "PAID" && !order.refundRequestedAt;
  const card = "rounded-2xl border border-black/10 bg-white p-5";

  return (
    <div className="max-w-[860px] space-y-6">
      <p className="text-sm"><Link href="/admin/sales" className="text-black/60 hover:underline">← Sales</Link></p>
      <h1 className="text-3xl font-medium text-black">Order {order.id.slice(-8)}</h1>

      <section className={card}>
        <dl className="grid gap-2 text-sm sm:grid-cols-[150px_1fr]">
          <dt className="text-black/60">Status</dt><dd className="font-medium">{order.status}{order.refundRequestedAt && order.status === "PAID" ? " (refund pending)" : ""}</dd>
          <dt className="text-black/60">Subtotal</dt><dd>{money(Number(order.subtotalAmount) || Number(order.totalAmount), order.currency)}</dd>
          <dt className="text-black/60">Discount</dt><dd>{Number(order.discountAmount) > 0 ? `- ${money(order.discountAmount, order.currency)}${order.coupon ? ` (coupon ${order.coupon.code})` : ""}` : "none"}</dd>
          <dt className="text-black/60">Fees</dt><dd>{money(order.feeAmount, order.currency)}</dd>
          <dt className="text-black/60">Total paid</dt><dd className="font-medium">{money(order.totalAmount, order.currency)}</dd>
          {order.invoiceNumber && (<><dt className="text-black/60">Invoice</dt><dd>{order.invoiceNumber}</dd></>)}
          <dt className="text-black/60">Buyer</dt><dd><Link href={`/admin/customers/${order.user.id}`} className="underline">{order.user.name || order.user.email}</Link> ({order.user.email}){order.user.phoneNumber ? `, ${order.user.phoneNumber}` : ""}{order.accountCreated ? " · account created at checkout" : ""}</dd>
          <dt className="text-black/60">Paid with</dt><dd>{order.provider ?? "none yet"}{order.mpesaReceipt ? `, M-Pesa receipt ${order.mpesaReceipt}` : ""}</dd>
          <dt className="text-black/60">Reference</dt><dd className="break-all">{order.providerReference ?? "none"}</dd>
          <dt className="text-black/60">Created</dt><dd>{when(order.createdAt)}</dd>
          {order.paidAt && (<><dt className="text-black/60">Paid</dt><dd>{when(order.paidAt)}</dd></>)}
          {order.failureReason && (<><dt className="text-black/60">Problem</dt><dd className="text-error">{order.failureReason}</dd></>)}
        </dl>
        <ul className="mt-4 divide-y divide-black/5 text-sm">
          {order.items.map((i) => (<li key={i.id} className="flex justify-between py-2"><span>{i.edition.title ?? i.edition.work.title}</span><span>{money(i.unitPrice, i.currency)}</span></li>))}
        </ul>
      </section>

      {canRefund && refundable && order.provider === "PAYSTACK" && (
        <section className={card} aria-labelledby="refund">
          <h2 id="refund" className="font-display text-xl text-black">Refund (card)</h2>
          <p className="mb-3 mt-1 text-sm text-black/60">Full refunds only. The order changes to REFUNDED, and access is removed, when Paystack confirms the refund.</p>
          <ActionForm action={refundOrderAction} hidden={{ orderId: order.id }} submitLabel="Request full refund" danger />
        </section>
      )}

      {canRefund && refundable && order.provider === "MPESA" && (
        <section className={card} aria-labelledby="manual-refund">
          <h2 id="manual-refund" className="font-display text-xl text-black">Refund (M-Pesa, manual)</h2>
          <p className="mb-3 mt-1 text-sm text-black/60">M-Pesa payments are paid back by you, outside this system. After you have sent the money, record it here. Access is removed immediately.</p>
          <ActionForm action={manualRefundAction} hidden={{ orderId: order.id }} submitLabel="Record manual refund and remove access" danger>
            <label className="block text-sm text-black/70">
              Reference of the money you sent back
              <input name="reference" required minLength={4} maxLength={80} className="mt-1 w-full rounded-xl border-black/20 text-sm" />
            </label>
          </ActionForm>
        </section>
      )}

      <section className={card} aria-labelledby="history">
        <h2 id="history" className="font-display text-xl text-black">History</h2>
        {history.length === 0 ? <p className="mt-2 text-sm text-black/50">No admin actions on this order.</p> : (
          <ul className="mt-2 divide-y divide-black/5 text-sm">
            {history.map((h) => (<li key={h.id} className="py-2"><span className="font-medium">{h.action}</span> by {h.admin.name} <span className="text-black/50">{when(h.createdAt)}</span><br /><span className="text-black/60">{JSON.stringify(h.meta)}</span></li>))}
          </ul>
        )}
      </section>
    </div>
  );
}
