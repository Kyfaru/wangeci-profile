import type { Metadata } from "next";

import { DataTable, pageFrom, type Column } from "@/components/admin/DataTable";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
type Row = { id: string; when: string; who: string; action: string; target: string; meta: string };

/** Read-only, owner only. Rows can only be added by admin actions, never edited or deleted here. */
export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRole("audit.read");
  const sp = await searchParams;
  const page = pageFrom(sp.page);
  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: { admin: { select: { name: true, email: true } } } }),
  ]);
  const rows: Row[] = logs.map((l) => ({
    id: l.id,
    when: l.createdAt.toISOString().slice(0, 19).replace("T", " "),
    who: l.admin.name || l.admin.email,
    action: l.action,
    target: `${l.targetType} ${l.targetId.slice(-8)}`,
    meta: l.meta ? JSON.stringify(l.meta) : "",
  }));
  const columns: Column<Row>[] = [
    { key: "when", label: "When (UTC)", render: (r) => r.when, className: "whitespace-nowrap" },
    { key: "who", label: "Who", render: (r) => r.who },
    { key: "action", label: "Action", render: (r) => <span className="font-medium">{r.action}</span> },
    { key: "target", label: "Target", render: (r) => r.target },
    { key: "meta", label: "Details", render: (r) => <span className="break-words text-black/60">{r.meta}</span> },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Audit log</h1>
      <DataTable caption="Audit log" columns={columns} rows={rows} page={page} pageSize={PAGE_SIZE} total={total} hrefForPage={(p) => `/admin/audit?page=${p}`} empty="No admin actions yet." />
    </div>
  );
}
