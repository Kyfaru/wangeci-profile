import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BreadcrumbBar } from "@/components/dashboard/BreadcrumbBar";
import { ReaderActions } from "@/components/dashboard/ReaderActions";
import { ReaderPager } from "@/components/dashboard/ReaderPager";
import { ReaderProgressSync } from "@/components/dashboard/ReaderProgressSync";
import { ReaderRail } from "@/components/dashboard/ReaderRail";
import { BOOK_PREVIEWS, DEFAULT_PREVIEW } from "@/lib/content/book-preview";
import { findBookBySlug, findEditionById, type ReadingChapter } from "@/lib/mock-books";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export async function generateMetadata({ params }: PageProps<"/dashboard/books/[slug]/read">): Promise<Metadata> {
  const book = findBookBySlug((await params).slug);
  if (!book) return {};
  return { title: `${book.title} — Reader` };
}

/** `/dashboard/books/[slug]/read` — Figma "The Book" frame. */
export default async function ReaderPage({ params, searchParams }: PageProps<"/dashboard/books/[slug]/read">) {
  const user = await requireUser();
  const { slug } = await params;
  const sp = await searchParams;

  const book = findBookBySlug(slug);
  if (!book) notFound();

  const editionId =
    (typeof sp.editionId === "string" ? sp.editionId : undefined) ??
    book.editions.find((e) => e.format === "ebook")?.id;
  if (!editionId) notFound();

  // The paywall: no entitlement row for this user and edition means no chapter text.
  const entitlement = await prisma.entitlement.findUnique({
    where: { userId_editionId: { userId: user.id, editionId } },
    select: { id: true },
  });
  if (!entitlement) notFound();

  const found = findEditionById(editionId);
  if (!found || found.edition.format !== "ebook") notFound();

  const chapters = found.edition.chapters as ReadingChapter[];
  const totalChapters = chapters.length;

  const requestedIdx = typeof sp.idx === "string" ? Number(sp.idx) : NaN;
  const idx = chapters.some((c) => c.idx === requestedIdx) ? requestedIdx : 0;
  const chapter = chapters.find((c) => c.idx === idx) ?? chapters[0];

  const bookmarks: { chapterIdx: number }[] = []; // Phase 4: real Bookmark table
  const preview = BOOK_PREVIEWS[book.slug] ?? DEFAULT_PREVIEW;

  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbBar
        bookTitle={book.title}
        actions={
          <ReaderActions
            editionId={editionId}
            chapterIdx={chapter.idx}
            initiallyBookmarked={bookmarks.some((b) => b.chapterIdx === chapter.idx)}
          />
        }
      />
      <div className="flex flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 px-6 py-6 md:px-16 md:py-8">
            <h1 className="font-display text-[34px] text-black">{chapter.title}</h1>
            <div className="mt-8 max-w-[680px] space-y-5 text-lg leading-relaxed text-black">
              <p>{chapter.content}</p>
            </div>
          </div>
          <ReaderPager
            baseHref={`/dashboard/books/${slug}/read`}
            editionId={editionId}
            chapterIdx={chapter.idx}
            prevIdx={chapter.idx > 0 ? chapter.idx - 1 : null}
            nextIdx={chapter.idx < totalChapters - 1 ? chapter.idx + 1 : null}
            totalChapters={totalChapters}
          />
        </div>
        <ReaderRail
          cover={book.cover}
          title={book.title}
          author={book.author}
          rating={book.rating}
          statCount={book.reviewCount}
          bookmarkCount={bookmarks.length}
          description={preview.intro || book.description}
        />
      </div>
      <ReaderProgressSync editionId={editionId} chapterIdx={chapter.idx} />
    </div>
  );
}
