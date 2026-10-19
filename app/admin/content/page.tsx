import type { Metadata } from "next";
import Link from "next/link";

import { createBookAction, editionActiveAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Content" };
export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-xl border-black/20 text-sm";

/**
 * Books and editions. New books are created here and their chapters are written or uploaded on the
 * "Manage chapters" page. Retiring never deletes: orders and owners keep their access.
 */
export default async function ContentPage() {
  await requireRole("content.manage");
  const works = await prisma.work.findMany({ orderBy: { createdAt: "asc" }, include: { editions: { orderBy: { format: "asc" }, include: { _count: { select: { chapters: true, entitlements: true } } } } } });

  return (
    <div className="max-w-[900px] space-y-8">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Content</h1>
      <p className="text-sm text-black/60">Books are managed here. Create a book, then use Manage chapters to write it, add audio and publish.</p>

      <details className="rounded-2xl border border-black/10 bg-white p-5">
        <summary className="min-h-11 cursor-pointer py-2 font-display text-xl text-black">New book</summary>
        <div className="mt-3">
          <ActionForm action={createBookAction} hidden={{}} submitLabel="Create book" withReason={false}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm text-black/70">Title<input name="title" required maxLength={200} className={field} /></label>
              <label className="block text-sm text-black/70">Web address (slug)<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={field} placeholder="my-book" /></label>
              <label className="block text-sm text-black/70">Author<input name="author" required maxLength={120} className={field} /></label>
              <label className="block text-sm text-black/70">
                Format
                <select name="format" className={field}>
                  <option value="EPUB">Ebook</option>
                  <option value="AUDIOBOOK">Audiobook</option>
                </select>
              </label>
              <label className="block text-sm text-black/70">Price<input name="price" type="number" step="0.01" min="0" required className={field} /></label>
              <label className="block text-sm text-black/70">Currency<input name="currency" defaultValue="KES" required maxLength={3} className={field} /></label>
              <label className="block text-sm text-black/70 sm:col-span-2">Narrator (audiobooks)<input name="narrator" maxLength={120} className={field} /></label>
              <label className="block text-sm text-black/70 sm:col-span-2">Description<textarea name="description" rows={3} maxLength={2000} className={field} /></label>
            </div>
          </ActionForm>
        </div>
      </details>

      {works.map((w) => (
        <section key={w.id} className="rounded-2xl border border-black/10 bg-white p-5">
          <h2 className="font-display text-2xl text-black">{w.title}</h2>
          <p className="text-sm text-black/50">{w.author} - /store/{w.slug}</p>
          <ul className="mt-4 space-y-5">
            {w.editions.map((e) => (
              <li key={e.id} className="border-t border-black/5 pt-4 text-sm">
                <p><span className="font-medium">{e.title ?? e.format}</span> <span className="text-black/50">({e.format.toLowerCase()}, {e.currency} {Number(e.price).toLocaleString("en-KE")}, {e._count.chapters} chapters, {e._count.entitlements} owners)</span> <span className={e.isActive ? "text-green" : "text-black/50"}>{e.isActive ? "for sale" : "not for sale"}</span></p>
                {e.format !== "PAPERBACK" && (
                  <>
                    <Link href={`/admin/content/${e.id}`} className="mt-1 inline-flex min-h-11 items-center underline">Manage chapters</Link>
                    <details className="mt-1"><summary className="min-h-11 cursor-pointer py-2 underline">{e.isActive ? "Retire" : "Publish"}</summary>
                      <div className="mt-2"><ActionForm action={editionActiveAction} hidden={{ editionId: e.id, active: e.isActive ? "false" : "true" }} submitLabel={e.isActive ? "Retire edition" : "Publish edition"} danger={e.isActive} /></div>
                    </details>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
