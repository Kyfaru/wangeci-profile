import type { Metadata } from "next";
import Link from "next/link";

import { TimeRangeControl } from "@/components/admin/TimeRangeControl";
import { getAttention, getOverview } from "@/lib/admin/stats";
import { parseTimeRange } from "@/lib/admin/time-range";
import { can } from "@/lib/permissions";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const money = (n: number, c = "KES") => `${c} ${n.toLocaleString("en-KE")}`;
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

const card = "rounded-2xl border border-black/10 bg-white p-5";

/** Admin overview: numbers only, computed on the server, no analytics tool needed. */
export default async function AdminOverviewPage({ searchParams }: PageProps<"/admin">) {
  const user = await requireRole("admin.access");
  if (!can(user.role, "sales.read")) {
    return <p className="text-lg text-black/70">There is nothing for your role on this page yet.</p>;
  }

  const sp = await searchParams;
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const range = parseTimeRange({ range: pick(sp.range), from: pick(sp.from), to: pick(sp.to) });
  const [o, attention] = await Promise.all([getOverview(range), getAttention(user.id)]);
  const maxRevenue = Math.max(1, ...o.series.map((s) => s.revenue));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-medium text-black md:text-4xl">Overview</h1>
        <p className="mt-1 text-sm text-black/60">
          {range.label}: {when(o.from)} to {when(o.to)} UTC
        </p>
        <div className="mt-4">
          <TimeRangeControl range={range} basePath="/admin" />
        </div>
      </div>

      {attention.length > 0 && (
        <section aria-label="Needs attention" className="rounded-2xl border border-gold bg-gold/10 p-5">
          <h2 className="font-display text-xl text-black">Needs attention</h2>
          <ul className="mt-2 space-y-1">
            {attention.map((a) => (
              <li key={a.key}>
                <Link href={a.href} className="text-black underline underline-offset-4 hover:text-gold">
                  {a.count} {a.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={card}>
          <dt className="text-sm text-black/60">Revenue (paid orders)</dt>
          <dd className="mt-1 font-display text-3xl text-navy">{money(o.revenue, o.currency)}</dd>
          <p className="mt-1 text-xs text-black/50">Refunded orders and complimentary access are not counted.</p>
        </div>
        <div className={card}>
          <dt className="text-sm text-black/60">Paid orders</dt>
          <dd className="mt-1 font-display text-3xl text-navy">{o.paidOrders}</dd>
        </div>
        <div className={card}>
          <dt className="text-sm text-black/60">Accounts with a valid session</dt>
          <dd className="mt-1 font-display text-3xl text-navy">{o.signedInAccounts}</dd>
          <p className="mt-1 text-xs text-black/50">Signed in now (not necessarily active).</p>
        </div>
        <div className={card}>
          <dt className="text-sm text-black/60">Active readers</dt>
          <dd className="mt-1 font-display text-3xl text-navy">{o.activeReaders}</dd>
          <p className="mt-1 text-xs text-black/50">People whose reading or listening place was saved in this period.</p>
        </div>
      </dl>

      <section className={card} aria-labelledby="ov-series">
        <h2 id="ov-series" className="font-display text-xl text-black">Revenue by {o.unit}</h2>
        {o.series.length === 0 ? (
          <p className="mt-3 text-black/50">No paid orders in this period.</p>
        ) : (
          <ul className="mt-4 space-y-1.5">
            {o.series.map((s) => (
              <li key={s.bucket} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
                <span className="text-black/60">{o.unit === "month" ? s.bucket.slice(0, 7) : when(s.bucket)}</span>
                <span className="h-3 rounded-full bg-black/5">
                  <span className="block h-3 rounded-full bg-gold-bright" style={{ width: `${Math.max(2, (s.revenue / maxRevenue) * 100)}%` }} />
                </span>
                <span className="tabular-nums text-black">{money(s.revenue)} ({s.orders})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={card} aria-labelledby="ov-books">
          <h2 id="ov-books" className="font-display text-xl text-black">Books bought, by edition</h2>
          {o.perEdition.length === 0 ? (
            <p className="mt-3 text-black/50">No purchases in this period.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-black/50"><tr><th className="py-1">Edition</th><th className="py-1 text-right">Bought</th><th className="py-1 text-right">Revenue</th></tr></thead>
              <tbody className="divide-y divide-black/5">
                {o.perEdition.map((e) => (
                  <tr key={e.editionId}><td className="py-2">{e.title} <span className="text-black/40">({e.format.toLowerCase()})</span></td><td className="py-2 text-right tabular-nums">{e.bought}</td><td className="py-2 text-right tabular-nums">{money(e.revenue)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={card} aria-labelledby="ov-progress">
          <h2 id="ov-progress" className="font-display text-xl text-black">Reading progress, by book (all time)</h2>
          {o.progress.length === 0 ? (
            <p className="mt-3 text-black/50">Nobody has started reading yet.</p>
          ) : (
            <table className="mt-3 w-full text-sm">
              <thead className="text-left text-xs uppercase text-black/50"><tr><th className="py-1">Edition</th><th className="py-1 text-right">Started</th><th className="py-1 text-right">Finished</th><th className="py-1 text-right">Average</th></tr></thead>
              <tbody className="divide-y divide-black/5">
                {o.progress.map((p) => (
                  <tr key={p.editionId}><td className="py-2">{p.title}</td><td className="py-2 text-right tabular-nums">{p.started}</td><td className="py-2 text-right tabular-nums">{p.finished}</td><td className="py-2 text-right tabular-nums">{p.averagePct}%</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className={card} aria-labelledby="ov-latest">
        <h2 id="ov-latest" className="font-display text-xl text-black">Latest orders</h2>
        {o.latestOrders.length === 0 ? (
          <p className="mt-3 text-black/50">No orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5 text-sm">
            {o.latestOrders.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/admin/sales/${x.id}`} className="hover:underline">{x.buyer}</Link>
                <span className="tabular-nums">{money(x.total, x.currency)}</span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs">{x.status}</span>
                <span className="text-black/50">{when(x.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
