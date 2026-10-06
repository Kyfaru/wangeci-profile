import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbBar } from "@/components/dashboard/BreadcrumbBar";
import { ChapterReaderClient } from "@/components/dashboard/ChapterReaderClient";
import { ReaderActions } from "@/components/dashboard/ReaderActions";
import { ReaderProgressSync } from "@/components/dashboard/ReaderProgressSync";
import { ReaderRail } from "@/components/dashboard/ReaderRail";
import { getBookBySlug } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";
import { parseLocator } from "@/lib/reading/locator";
import { requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboard/books/[slug]/read">): Promise<Metadata> {
  const book = await getBookBySlug((await params).slug);
  return book ? { title: `${book.title}: Reader`, robots: { index: false } } : {};
}

/**
 * `/dashboard/books/[slug]/read`: Figma "The Book" frame. The server checks the session and the
 * purchase, sends ONE chapter, and the browser lays it out in pages that fit this screen.
 * `?idx=` picks a chapter, `?w=` a word (`end` = the last page, used when stepping back a chapter).
 */
export default async function ReaderPage({ params, searchParams }: PageProps<"/dashboard/books/[slug]/read">) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;

  const book = await getBookBySlug(slug);
  const ebook = book?.editions.find((e) => e.format === "ebook");
  if (!book || !ebook) notFound();

  // The paywall: no entitlement row for this user and edition means no chapter text.
  const entitled = await prisma.entitlement.findUnique({ where: { userId_editionId: { userId: user.id, editionId: ebook.id } }, select: { id: true } });
  if (!entitled) notFound();

  const chapters = await prisma.chapter.findMany({ where: { editionId: ebook.id }, orderBy: { idx: "asc" }, select: { idx: true, title: true, wordCount: true } });
  if (chapters.length === 0) notFound();

  // Which chapter and word? Explicit link first, otherwise resume where the saved position says.
  const saved = await prisma.readingPosition.findUnique({ where: { userId_editionId: { userId: user.id, editionId: ebook.id } }, select: { locator: true } });
  const resume = saved ? parseLocator(saved.locator) : null;
  const wantedIdx = typeof sp.idx === "string" ? Number(sp.idx) : (resume?.chapterIdx ?? chapters[0].idx);
  const position = Math.max(0, chapters.findIndex((c) => c.idx === wantedIdx));
  const meta = chapters[position];
  const startWord = typeof sp.idx === "string" ? (sp.w === "end" ? Math.max(0, meta.wordCount - 1) : Number(sp.w) || 0) : (resume?.offset ?? 0);

  const [chapter, bookmarks] = await Promise.all([
    prisma.chapter.findUnique({ where: { editionId_idx: { editionId: ebook.id, idx: meta.idx } }, select: { title: true, body: true } }),
    prisma.bookmark.findMany({ where: { userId: user.id, editionId: ebook.id, chapterIdx: meta.idx }, select: { id: true, position: true } }),
  ]);
  const paragraphs = (chapter?.body ?? "").split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const wordsBefore = chapters.slice(0, position).reduce((n, c) => n + c.wordCount, 0);
  const totalWords = chapters.reduce((n, c) => n + c.wordCount, 0);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
      <BreadcrumbBar bookTitle={book.title} actions={<ReaderActions key={meta.idx} editionId={ebook.id} chapterIdx={meta.idx} bookmarks={bookmarks} />} />
      <div className="flex min-h-0 flex-1">
        <ChapterReaderClient
          key={meta.idx}
          slug={slug}
          editionId={ebook.id}
          chapterIdx={meta.idx}
          title={meta.title}
          paragraphs={paragraphs}
          startWord={startWord}
          prevIdx={position > 0 ? chapters[position - 1].idx : null}
          nextIdx={position < chapters.length - 1 ? chapters[position + 1].idx : null}
          wordsBefore={wordsBefore}
          wordsInChapter={meta.wordCount}
          totalWords={totalWords}
        />
        <ReaderRail cover={book.cover} title={book.title} author={book.author} description={book.description ?? ""} />
      </div>
      <ReaderProgressSync />
    </div>
  );
}
