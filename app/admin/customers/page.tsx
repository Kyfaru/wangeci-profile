import type { Metadata } from "next";
import Link from "next/link";

import { DataTable, pageFrom, type Column } from "@/components/admin/DataTable";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
type Row = { id: string; name: string; email: string; role: string; verified: string; owned: number; banned: boolean; fromCheckout: boolean; joined: string };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  await requireRole("customers.read");
  const sp = await searchParams;
  const page = pageFrom(sp.page);
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);

  const where = q ? { OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }, { phoneNumber: { contains: q } }] } : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { _count: { select: { entitlements: true } }, orders: { where: { accountCreated: true }, select: { id: true }, take: 1 } } }),
  ]);
  const rows: Row[] = users.map((u) => ({ id: u.id, name: u.name || "(no name)", email: u.email, role: u.role, verified: `${u.emailVerified ? "email" : ""}${u.emailVerified && u.phoneNumberVerified ? " + " : ""}${u.phoneNumberVerified ? "phone" : ""}` || "none", owned: u._count.entitlements, banned: u.banned, fromCheckout: u.orders.length > 0, joined: u.createdAt.toISOString().slice(0, 10) }));

  const columns: Column<Row>[] = [
    { key: "name", label: "Customer", render: (r) => (<><Link href={`/admin/customers/${r.id}`} className="font-medium hover:underline">{r.name}</Link><span className="block text-xs text-black/50">{r.email}</span></>) },
    { key: "role", label: "Role", render: (r) => r.role },
    { key: "verified", label: "Verified", render: (r) => r.verified },
    { key: "owned", label: "Books", render: (r) => r.owned, className: "tabular-nums" },
    { key: "status", label: "Status", render: (r) => (r.banned ? <span className="text-error">banned</span> : <>active{r.fromCheckout && <span className="block text-xs text-black/50">created at checkout</span>}</>) },
    { key: "joined", label: "Joined", render: (r) => r.joined },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Customers</h1>
      <form method="get" action="/admin/customers" className="flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, email or phone" className="w-full rounded-full border-black/20 px-4 py-2 text-sm" />
        <button type="submit" className="rounded-full border border-black/20 px-4 text-sm hover:border-navy">Search</button>
      </form>
      <DataTable caption="Customers" columns={columns} rows={rows} page={page} pageSize={PAGE_SIZE} total={total} hrefForPage={(p) => `/admin/customers?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} empty="No customers found." />
    </div>
  );
}
