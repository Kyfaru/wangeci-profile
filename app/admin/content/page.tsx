import type { Metadata } from "next";

import { editionActiveAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

/**
 * Books and editions. Creating a book and uploading its files is done with scripts/publish-edition.ts
 * (see docs/PUBLISHING.md); here the owner publishes or retires an edition. Retiring never deletes:
 * orders and owners keep their access.
 */
export default async function ContentPage() {
  await requireRole("content.manage");
  const works = await prisma.work.findMany({ orderBy: { createdAt: "asc" }, include: { editions: { orderBy: { format: "asc" }, include: { _count: { select: { chapters: true, entitlements: true } } } } } });

  return (
    <div className="max-w-[900px] space-y-8">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Content</h1>
      <p className="text-sm text-black/60">To add a book or upload files, use the publish script (docs/PUBLISHING.md).</p>
      {works.map((w) => (
        <section key={w.id} className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="font-display text-2xl text-black">{w.title}</h2>
          <p className="text-sm text-black/50">{w.author} · /store/{w.slug}</p>
          <ul className="mt-4 space-y-5">
            {w.editions.map((e) => (
              <li key={e.id} className="border-t border-black/5 pt-4 text-sm">
                <p><span className="font-medium">{e.title ?? e.format}</span> <span className="text-black/50">({e.format.toLowerCase()}, {e.currency} {Number(e.price).toLocaleString("en-KE")}, {e._count.chapters} chapters, {e._count.entitlements} owners)</span> <span className={e.isActive ? "text-green" : "text-black/50"}>{e.isActive ? "for sale" : "not for sale"}</span></p>
                {e.format !== "PAPERBACK" && (
                  <details className="mt-2"><summary className="cursor-pointer underline">{e.isActive ? "Retire" : "Publish"}</summary>
                    <div className="mt-2"><ActionForm action={editionActiveAction} hidden={{ editionId: e.id, active: e.isActive ? "false" : "true" }} submitLabel={e.isActive ? "Retire edition" : "Publish edition"} danger={e.isActive} /></div>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
