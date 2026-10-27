import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { deleteChapterAction, editionActiveAction, moveChapterAction, saveChapterAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { ChapterAudioUploader, mmss } from "@/components/admin/ChapterAudioUploader";
import { ChapterBodyField } from "@/components/admin/ChapterBodyField";
import { DataTable } from "@/components/admin/DataTable";
import { ManuscriptImport } from "@/components/admin/ManuscriptImport";
import { getPublishIssues } from "@/lib/admin/content";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Manage chapters" };
export const dynamic = "force-dynamic";

const card = "rounded-2xl border border-black/10 bg-white p-5";
const field = "mt-1 w-full rounded-xl border-black/20 text-sm";

/** Content editors: write chapters, attach audio, check readiness, publish. Every change is audited by the actions. */
export default async function EditionChaptersPage({ params, searchParams }: PageProps<"/admin/content/[editionId]">) {
  await requireRole("content.manage");
  const { editionId } = await params;
  const query = await searchParams;
  const editId = typeof query.edit === "string" ? query.edit : "";

  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      work: true,
      // Everything except `body`: chapter text can be huge and the table does not show it.
      chapters: { orderBy: { idx: "asc" }, select: { id: true, idx: true, title: true, wordCount: true, isFreePreview: true, durationSeconds: true, updatedAt: true } },
      _count: { select: { entitlements: true, readingPositions: true, bookmarks: true } },
    },
  });
  if (!edition) notFound();

  const selected = edition.chapters.find((c) => c.id === editId) ?? null;
  const selectedBody = selected ? ((await prisma.chapter.findUnique({ where: { id: selected.id }, select: { body: true } }))?.body ?? "") : "";
  const issues = await getPublishIssues(edition.id);

  const owners = edition._count.entitlements;
  const locked = edition._count.readingPositions > 0 || edition._count.bookmarks > 0; // reordering would move readers' saved places
  const needsReason = edition.isActive || owners > 0;
  const isAudio = edition.format === "AUDIOBOOK";
  const last = edition.chapters.length - 1;
  const previewIdx = (selected ?? edition.chapters[0])?.idx ?? 0;

  return (
    <div className="max-w-[960px] space-y-8">
      <div>
        <Link href="/admin/content" className="text-sm underline">All content</Link>
        <h1 className="mt-1 text-3xl font-medium text-black md:text-4xl">{edition.title ?? edition.work.title}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/60">
          <span>{edition.format.toLowerCase()}</span>
          <span>{edition.currency} {Number(edition.price).toLocaleString("en-KE")}</span>
          <span className={edition.isActive ? "font-medium text-green" : "font-medium text-black/60"}>{edition.isActive ? "Live" : "Draft"}</span>
          <span>{owners} owner{owners === 1 ? "" : "s"}</span>
          <Link href={`/dashboard/books/${edition.work.slug}/read?preview=${edition.id}&idx=${previewIdx}`} className="underline">Preview in reader</Link>
        </p>
      </div>

      <section className={card} aria-labelledby="ready">
        <h2 id="ready" className="font-display text-xl text-black">Ready to publish?</h2>
        {issues.blocking.length === 0 && issues.warnings.length === 0 ? (
          <p className="mt-2 text-sm font-medium text-green">Ready to publish</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {issues.blocking.map((m) => <li key={m} className="text-error">Blocking: {m}</li>)}
            {issues.warnings.map((m) => <li key={m} className="text-amber-700">Warning: {m}</li>)}
          </ul>
        )}
        <div className="mt-3">
          <ActionForm action={editionActiveAction} hidden={{ editionId: edition.id, active: edition.isActive ? "false" : "true" }} submitLabel={edition.isActive ? "Unpublish" : "Publish"} danger={edition.isActive} />
        </div>
      </section>

      <section aria-labelledby="chapters" className="space-y-3">
        <h2 id="chapters" className="font-display text-xl text-black">Chapters</h2>
        {locked && <p className="text-sm text-black/60">Moving chapters is switched off because readers have saved places or bookmarks in this book.</p>}
        <DataTable
          caption="Chapters"
          page={1}
          pageSize={Math.max(1, edition.chapters.length)}
          total={edition.chapters.length}
          hrefForPage={() => `/admin/content/${edition.id}`}
          empty="No chapters yet. Add one below or paste a whole manuscript."
          rows={edition.chapters}
          columns={[
            { key: "n", label: "#", render: (c) => c.idx + 1 },
            { key: "title", label: "Title", render: (c) => c.title },
            { key: "words", label: "Words", render: (c) => c.wordCount.toLocaleString("en-KE") },
            { key: "free", label: "Free preview", render: (c) => (c.isFreePreview ? "Yes" : "No") },
            { key: "audio", label: "Audio", render: (c) => (c.durationSeconds ? mmss(c.durationSeconds) : "none") },
            { key: "upd", label: "Updated", render: (c) => c.updatedAt.toISOString().slice(0, 10) },
            {
              key: "act",
              label: "Actions",
              render: (c) => (
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/content/${edition.id}?edit=${c.id}#editor`} className="inline-flex min-h-11 items-center underline">Edit</Link>
                  {!locked && c.idx > 0 && <ActionForm action={moveChapterAction} hidden={{ chapterId: c.id, dir: "up" }} submitLabel="Up" withReason={false} />}
                  {!locked && c.idx < last && <ActionForm action={moveChapterAction} hidden={{ chapterId: c.id, dir: "down" }} submitLabel="Down" withReason={false} />}
                  {c.idx === last && <ActionForm action={deleteChapterAction} hidden={{ chapterId: c.id }} submitLabel="Delete" danger />}
                </div>
              ),
            },
          ]}
        />
      </section>

      <section id="editor" className={card} aria-labelledby="editor-h">
        <h2 id="editor-h" className="font-display text-xl text-black">{selected ? `Edit: ${selected.title}` : "Add a chapter"}</h2>
        {selected && <Link href={`/admin/content/${edition.id}`} className="text-sm underline">Add a new chapter instead</Link>}
        <div className="mt-3">
          <ActionForm
            key={selected?.id ?? "new"}
            action={saveChapterAction}
            hidden={{ editionId: edition.id, chapterId: selected?.id ?? "" }}
            submitLabel={selected ? "Save chapter" : "Add chapter"}
            withReason={needsReason}
          >
            <label className="block text-sm text-black/70">Title<input name="title" required maxLength={200} defaultValue={selected?.title ?? ""} className={field} /></label>
            <label className="flex min-h-11 items-center gap-2 text-sm text-black/70"><input type="checkbox" name="isFreePreview" defaultChecked={selected?.isFreePreview ?? false} className="size-5 rounded" /> Free preview chapter</label>
            <ChapterBodyField editionId={edition.id} chapterId={selected?.id ?? ""} initial={selectedBody} owners={owners} />
          </ActionForm>
        </div>
      </section>

      {isAudio && (
        <section className={card} aria-labelledby="audio">
          <h2 id="audio" className="font-display text-xl text-black">Chapter audio</h2>
          {selected ? (
            <>
              <p className="mt-1 text-sm text-black/60">For: {selected.title}</p>
              <div className="mt-3"><ChapterAudioUploader key={selected.id} editionId={edition.id} chapterId={selected.id} current={selected.durationSeconds} /></div>
            </>
          ) : (
            <p className="mt-2 text-sm text-black/50">Choose a chapter with Edit to attach its audio.</p>
          )}
        </section>
      )}

      <ManuscriptImport editionId={edition.id} needsReason={needsReason} />
    </div>
  );
}
