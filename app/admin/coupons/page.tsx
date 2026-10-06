import type { Metadata } from "next";

import { createCouponAction, setCouponActiveAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Coupons" };
export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-black/10 bg-white p-5";
const field = "mt-1 w-full rounded-xl border-black/20 text-sm";

/** Owner only. Every change needs a typed reason and is written to the audit log. */
export default async function CouponsPage() {
  await requireRole("coupon.manage");
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div className="max-w-[860px] space-y-8">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Coupons</h1>

      <section className={card} aria-labelledby="new">
        <h2 id="new" className="font-display text-xl text-black">New coupon</h2>
        <div className="mt-3">
          <ActionForm action={createCouponAction} hidden={{}} submitLabel="Create coupon">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-black/70">Code<input name="code" required minLength={3} maxLength={30} className={field} placeholder="WELCOME10" /></label>
              <label className="block text-sm text-black/70">
                Type
                <select name="type" className={field}>
                  <option value="PERCENT">Percent off</option>
                  <option value="FIXED">Fixed amount off (KES)</option>
                </select>
              </label>
              <label className="block text-sm text-black/70">Value<input name="value" type="number" step="0.01" min="0.01" required className={field} /></label>
              <label className="block text-sm text-black/70">Minimum subtotal (optional)<input name="minSubtotal" type="number" step="1" min="0" className={field} /></label>
              <label className="block text-sm text-black/70">Max uses (optional)<input name="maxRedemptions" type="number" step="1" min="1" className={field} /></label>
              <label className="block text-sm text-black/70">Last day (optional)<input name="endsAt" type="date" className={field} /></label>
            </div>
          </ActionForm>
        </div>
      </section>

      <section className={card} aria-labelledby="all">
        <h2 id="all" className="font-display text-xl text-black">All coupons</h2>
        {coupons.length === 0 ? (
          <p className="mt-2 text-sm text-black/50">No coupons yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 text-sm">
            {coupons.map((c) => (
              <li key={c.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{c.code}</span>{" "}
                    <span className="text-black/60">{c.type === "PERCENT" ? `${Number(c.value)}% off` : `KES ${Number(c.value).toLocaleString("en-KE")} off`}</span>
                  </span>
                  <span className={c.isActive ? "text-green" : "text-black/50"}>
                    {c.isActive ? "active" : "off"} · used {c.timesRedeemed}
                    {c.maxRedemptions !== null ? ` of ${c.maxRedemptions}` : ""}
                    {c.endsAt ? ` · ends ${c.endsAt.toISOString().slice(0, 10)}` : ""}
                  </span>
                </div>
                <ActionForm action={setCouponActiveAction} hidden={{ couponId: c.id, active: String(!c.isActive) }} submitLabel={c.isActive ? "Turn off" : "Turn on"} danger={c.isActive} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
