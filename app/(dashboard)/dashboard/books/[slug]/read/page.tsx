import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BreadcrumbBar } from "@/components/dashboard/BreadcrumbBar";
import { ChapterReaderClient } from "@/components/dashboard/ChapterReaderClient";
import { ReaderActions } from "@/components/dashboard/ReaderActions";
import { ReaderProgressSync } from "@/components/dashboard/ReaderProgressSync";
import { ReaderRail } from "@/components/dashboard/ReaderRail";
import { coverFrom, FALLBACK_COVER, getBookBySlug, getOwnedBook } from "@/lib/catalogue";
import { prisma } from "@/lib/prisma";
import { parseLocator, resolveStart } from "@/lib/reading/locator";
import { splitParagraphs } from "@/lib/reading/text";
import { checkAdmin, requireUser } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/dashboard/books/[slug]/read">): Promise<Metadata> {
  const book = await getBookBySlug((await params).slug);
  return book ? { title: `${book.title}: Reader`, robots: { index: false } } : {};
}

/**
 * `/dashboard/books/[slug]/read`: Figma "The Book" frame. The server checks the session and the
 * purchase, sends ONE chapter, and the browser lays it out in pages that fit this screen.
 * `?idx=` picks a chapter, `?w=` a word (`end` = the last page, used when stepping back a chapter).
 * `?preview=<editionId>` is the owner's draft preview: it ignores isActive and purchases, and saves nothing.
 */
export default async function ReaderPage({ params, searchParams }: PageProps<"/dashboard/books/[slug]/read">) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;

  const previewId = typeof sp.preview === "string" ? sp.preview : null;
  const isPreview = previewId !== null && (await checkAdmin("content.manage")).ok;

  let book: { title: string; author: string; description: string | null; cover: string };
  let editionId: string;
  if (isPreview) {
    const edition = await prisma.edition.findFirst({
      where: { id: previewId, format: "EPUB", work: { slug } },
      include: { work: true, assets: { where: { kind: "COVER_IMAGE" }, take: 1 } },
    });
    if (!edition) notFound();
    book = { title: edition.work.title, author: edition.work.author, description: edition.work.description, cover: coverFrom(edition.assets) ?? FALLBACK_COVER };
    editionId = edition.id;
  } else {
    // Owners keep reading an edition that was later retired, so the lookup is by ownership, not by isActive.
    const owned = await getOwnedBook(slug, user.id);
    const ebook = owned?.editions.find((e) => e.format === "ebook");
    if (!owned || !ebook) notFound();
    book = owned;
    editionId = ebook.id;
  }

  const chapters = await prisma.chapter.findMany({ where: { editionId }, orderBy: { idx: "asc" }, select: { idx: true, title: true, wordCount: true } });
  if (chapters.length === 0) notFound();

  // Which chapter and word? Explicit link first, otherwise resume where the saved position says.
  const saved = isPreview ? null : await prisma.readingPosition.findUnique({ where: { userId_editionId: { userId: user.id, editionId } }, select: { locator: true } });
  const { position, startWord } = resolveStart(sp, saved ? parseLocator(saved.locator) : null, chapters);
  const meta = chapters[position];

  const [chapter, bookmarks] = await Promise.all([
    prisma.chapter.findUnique({ where: { editionId_idx: { editionId, idx: meta.idx } }, select: { title: true, body: true } }),
    isPreview ? [] : prisma.bookmark.findMany({ where: { userId: user.id, editionId, chapterIdx: meta.idx }, select: { id: true, position: true } }),
  ]);
  const paragraphs = splitParagraphs(chapter?.body ?? "");
  const wordsBefore = chapters.slice(0, position).reduce((n, c) => n + c.wordCount, 0);
  const totalWords = chapters.reduce((n, c) => n + c.wordCount, 0);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col md:h-dvh">
      {isPreview && <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">Preview, nothing is saved</div>}
      <BreadcrumbBar bookTitle={book.title} actions={isPreview ? undefined : <ReaderActions key={meta.idx} editionId={editionId} chapterIdx={meta.idx} bookmarks={bookmarks} />} />
      <div className="flex min-h-0 flex-1">
        <ChapterReaderClient
          key={meta.idx}
          slug={slug}
          editionId={editionId}
          chapterIdx={meta.idx}
          title={meta.title}
          paragraphs={paragraphs}
          startWord={startWord}
          prevIdx={position > 0 ? chapters[position - 1].idx : null}
          nextIdx={position < chapters.length - 1 ? chapters[position + 1].idx : null}
          wordsBefore={wordsBefore}
          wordsInChapter={meta.wordCount}
          totalWords={totalWords}
          previewId={isPreview ? editionId : undefined}
        />
        <ReaderRail cover={book.cover} title={book.title} author={book.author} description={book.description ?? ""} />
      </div>
      {!isPreview && <ReaderProgressSync />}
    </div>
  );
}
