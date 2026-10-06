import type { Metadata } from "next";
import Link from "next/link";

import { BookmarkRow } from "@/components/dashboard/BookmarkRow";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "My Bookmarks" };
export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const user = await requireUser();
  const marks = await prisma.bookmark.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }],
    include: { edition: { include: { work: true } } },
  });
  const chapters = await prisma.chapter.findMany({
    where: { OR: marks.map((m) => ({ editionId: m.editionId, idx: m.chapterIdx })) },
    select: { editionId: true, idx: true, title: true },
  });

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        <h1 className="text-3xl font-medium text-black md:text-4xl">My Bookmarks</h1>
        {marks.length === 0 ? (
          <p className="mt-6 text-lg text-black/70">
            No bookmarks yet. While reading, tap the bookmark icon to save your place. <Link href="/dashboard/books" className="underline">Go to My Books</Link>
          </p>
        ) : (
          <ul className="mt-8 max-w-[760px] divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
            {marks.map((m) => (
              <BookmarkRow
                key={m.id}
                id={m.id}
                href={`/dashboard/books/${m.edition.work.slug}/read?idx=${m.chapterIdx}&w=${m.position}`}
                book={m.edition.title ?? m.edition.work.title}
                chapter={chapters.find((c) => c.editionId === m.editionId && c.idx === m.chapterIdx)?.title ?? `Chapter ${m.chapterIdx + 1}`}
                savedAt={m.createdAt.toISOString().slice(0, 10)}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
