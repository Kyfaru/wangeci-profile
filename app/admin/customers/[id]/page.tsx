import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { banAction, grantAccessAction, revokeAccessAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/server/audit";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Customer" };
export const dynamic = "force-dynamic";

const when = (d: Date) => d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
const card = "rounded-2xl border border-black/10 bg-white p-5";

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const admin = await requireRole("customers.read");
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
      entitlements: { include: { edition: { include: { work: { select: { title: true } } } } }, orderBy: { grantedAt: "desc" } },
      readingPositions: { include: { edition: { include: { work: { select: { title: true } } } } } },
    },
  });
  if (!user) notFound();

  // One customer's progress is personal data: only shown on this page, only to roles allowed to see it, and every view is logged.
  const showProgress = can(admin.role, "customer.progress.view");
  if (showProgress) await recordAudit({ adminId: admin.id, action: "customer.progress.viewed", targetType: "user", targetId: user.id });

  const sellable = await prisma.edition.findMany({ where: { format: { in: ["EPUB", "AUDIOBOOK"] } }, include: { work: { select: { title: true } } } });
  const canGrant = can(admin.role, "access.grant");
  const canRevoke = can(admin.role, "access.revoke");
  const canBan = can(admin.role, "customer.ban") && user.role === "reader" && user.id !== admin.id;

  return (
    <div className="max-w-[860px] space-y-6">
      <p className="text-sm"><Link href="/admin/customers" className="text-black/60 hover:underline">← Customers</Link></p>
      <h1 className="text-3xl font-medium text-black">{user.name || user.email}</h1>

      <section className={card}>
        <dl className="grid gap-2 text-sm sm:grid-cols-[150px_1fr]">
          <dt className="text-black/60">Email</dt><dd>{user.email} {user.emailVerified ? "(verified)" : "(not verified)"}</dd>
          <dt className="text-black/60">Phone</dt><dd>{user.phoneNumber ?? "none"} {user.phoneNumberVerified ? "(verified)" : ""}</dd>
          <dt className="text-black/60">Role</dt><dd>{user.role}</dd>
          <dt className="text-black/60">Joined</dt><dd>{when(user.createdAt)}</dd>
          <dt className="text-black/60">Last seen</dt><dd>{user.lastSeenAt ? when(user.lastSeenAt) : "never"}</dd>
          {user.banned && (<><dt className="text-black/60">Banned</dt><dd className="text-error">{user.banReason}</dd></>)}
        </dl>
      </section>

      <section className={card} aria-labelledby="orders">
        <h2 id="orders" className="font-display text-xl text-black">Orders</h2>
        {user.orders.length === 0 ? <p className="mt-2 text-sm text-black/50">No orders.</p> : (
          <ul className="mt-2 divide-y divide-black/5 text-sm">
            {user.orders.map((o) => (<li key={o.id} className="flex flex-wrap justify-between gap-2 py-2"><Link href={`/admin/sales/${o.id}`} className="underline">{o.id.slice(-8)}</Link><span>{o.currency} {Number(o.totalAmount).toLocaleString("en-KE")}</span><span>{o.status}</span><span className="text-black/50">{when(o.createdAt)}</span></li>))}
          </ul>
        )}
      </section>

      <section className={card} aria-labelledby="books">
        <h2 id="books" className="font-display text-xl text-black">Books owned</h2>
        {user.entitlements.length === 0 ? <p className="mt-2 text-sm text-black/50">None.</p> : (
          <ul className="mt-2 space-y-4 text-sm">
            {user.entitlements.map((e) => (
              <li key={e.id}>
                <p><span className="font-medium">{e.edition.title ?? e.edition.work.title}</span> <span className="text-black/50">({e.edition.format.toLowerCase()}, {e.orderId ? "paid" : "complimentary"})</span></p>
                {canRevoke && !e.orderId && (
                  <details className="mt-1"><summary className="cursor-pointer text-black/60 underline">Remove complimentary access</summary>
                    <div className="mt-2"><ActionForm action={revokeAccessAction} hidden={{ entitlementId: e.id }} submitLabel="Remove access" danger /></div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        {canGrant && (
          <details className="mt-4"><summary className="cursor-pointer text-sm font-medium underline">Give complimentary access</summary>
            <div className="mt-3">
              <ActionForm action={grantAccessAction} hidden={{ userId: user.id }} submitLabel="Grant access">
                <label className="block text-sm text-black/70">Edition
                  <select name="editionId" required className="mt-1 w-full rounded-xl border-black/20 text-sm">
                    {sellable.map((s) => (<option key={s.id} value={s.id}>{s.title ?? s.work.title} ({s.format.toLowerCase()})</option>))}
                  </select>
                </label>
              </ActionForm>
            </div>
          </details>
        )}
      </section>

      {showProgress && (
        <section className={card} aria-labelledby="progress">
          <h2 id="progress" className="font-display text-xl text-black">Reading and listening progress</h2>
          <p className="mt-1 text-xs text-black/50">Viewing this is recorded in the audit log.</p>
          {user.readingPositions.length === 0 ? <p className="mt-2 text-sm text-black/50">Nothing yet.</p> : (
            <ul className="mt-2 divide-y divide-black/5 text-sm">
              {user.readingPositions.map((p) => (<li key={p.id} className="flex justify-between py-2"><span>{p.edition.title ?? p.edition.work.title}</span><span className="tabular-nums">{Math.round(p.progressPct)}% (updated {when(p.updatedAt)})</span></li>))}
            </ul>
          )}
        </section>
      )}

      {canBan && (
        <section className={card} aria-labelledby="ban">
          <h2 id="ban" className="font-display text-xl text-black">{user.banned ? "Unban" : "Ban"}</h2>
          <div className="mt-2">
            <ActionForm action={banAction} hidden={{ userId: user.id, banned: user.banned ? "false" : "true" }} submitLabel={user.banned ? "Unban customer" : "Ban customer and sign them out"} danger={!user.banned} />
          </div>
        </section>
      )}
    </div>
  );
}
