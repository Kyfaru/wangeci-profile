import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, pageFrom, type Column } from "@/components/admin/DataTable";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED", "EXPIRED"] as const;
const money = (n: unknown, c: string) => `${c} ${Number(n).toLocaleString("en-KE")}`;

type Row = { id: string; buyer: string; email: string; total: string; status: string; provider: string; createdAt: string; refundPending: boolean };

export default async function SalesPage({ searchParams }: PageProps<"/admin/sales">) {
  await requireRole("sales.read");
  const sp = await searchParams;
  const page = pageFrom(sp.page);
  const status = STATUSES.find((s) => s === sp.status);

  const where = status ? { status } : {};
  const [total, orders, perEdition] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { user: { select: { name: true, email: true } } } }),
    prisma.orderItem.groupBy({ by: ["editionId"], where: { order: { status: "PAID" } }, _count: true, _sum: { unitPrice: true } }),
  ]);
  const editions = await prisma.edition.findMany({ where: { id: { in: perEdition.map((p) => p.editionId) } }, include: { work: { select: { title: true } } } });

  const rows: Row[] = orders.map((o) => ({
    id: o.id,
    buyer: o.user.name || "(no name)",
    email: o.user.email,
    total: money(o.totalAmount, o.currency),
    status: o.status,
    provider: o.provider ?? "",
    createdAt: o.createdAt.toISOString().slice(0, 16).replace("T", " "),
    refundPending: Boolean(o.refundRequestedAt) && o.status === "PAID",
  }));

  const columns: Column<Row>[] = [
    { key: "buyer", label: "Buyer", render: (r) => (<><Link href={`/admin/sales/${r.id}`} className="font-medium hover:underline">{r.buyer}</Link><span className="block text-xs text-black/50">{r.email}</span></>) },
    { key: "total", label: "Total", render: (r) => r.total, className: "tabular-nums" },
    { key: "status", label: "Status", render: (r) => (<>{r.status}{r.refundPending && <span className="ml-1 text-xs text-gold">(refund pending)</span>}</>) },
    { key: "provider", label: "Via", render: (r) => r.provider.toLowerCase() },
    { key: "createdAt", label: "Created (UTC)", render: (r) => r.createdAt },
  ];
  const hrefFor = (p: number) => `/admin/sales?${new URLSearchParams({ ...(status ? { status } : {}), page: String(p) })}`;

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Sales</h1>

      <section aria-labelledby="by-edition">
        <h2 id="by-edition" className="font-display text-xl text-black">Per edition (paid orders, all time)</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-black/10 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-black/10 bg-cream/60 text-left text-xs uppercase text-black/60"><tr><th className="px-4 py-3">Edition</th><th className="px-4 py-3 text-right">Sold</th><th className="px-4 py-3 text-right">Revenue</th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {perEdition.length === 0 ? <tr><td colSpan={3} className="px-4 py-6 text-center text-black/50">No sales yet.</td></tr> : perEdition.map((p) => {
                const e = editions.find((x) => x.id === p.editionId);
                return <tr key={p.editionId}><td className="px-4 py-3">{e ? (e.title ?? e.work.title) : p.editionId}</td><td className="px-4 py-3 text-right tabular-nums">{p._count}</td><td className="px-4 py-3 text-right tabular-nums">{money(p._sum.unitPrice ?? 0, "KES")}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="orders">
        <h2 id="orders" className="font-display text-xl text-black">Orders</h2>
        <nav aria-label="Filter by status" className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/sales" className={`rounded-full border px-3 py-1 text-sm ${!status ? "border-navy bg-navy text-cream" : "border-black/20"}`}>All</Link>
          {STATUSES.map((s) => (
            <Link key={s} href={`/admin/sales?status=${s}`} className={`rounded-full border px-3 py-1 text-sm ${status === s ? "border-navy bg-navy text-cream" : "border-black/20"}`}>{s}</Link>
          ))}
        </nav>
        <div className="mt-4">
          <DataTable caption="Orders" columns={columns} rows={rows} page={page} pageSize={PAGE_SIZE} total={total} hrefForPage={hrefFor} empty="No orders match." />
        </div>
      </section>
    </div>
  );
}
