import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { ReaderTopbar } from "@/components/layout/ReaderTopbar";
import { BookMetaPanel } from "@/components/reader/BookMetaPanel";
import { PaginationBar } from "@/components/reader/PaginationBar";
import { ListenButton } from "@/components/reader/ListenButton";
import { ReaderHeaderActions } from "@/components/reader/ReaderHeaderActions";
import { ReadingProgressTracker } from "@/components/reader/ReadingProgressTracker";
import { BookOpenIcon, ClockIcon } from "@/components/reader/icons";
import {
  findBookBySlug,
  type BookEdition,
  type ListeningChapter,
  type ReadingChapter,
} from "@/lib/mock-books";

interface ReaderPageParams {
  id: string;
}

interface ReaderPageSearchParams {
  chapter?: string | string[];
}

interface ReaderPageProps {
  params: Promise<ReaderPageParams>;
  searchParams: Promise<ReaderPageSearchParams>;
}

function isEbookEdition(
  edition: BookEdition,
): edition is BookEdition & { chapters: ReadingChapter[] } {
  return edition.format === "ebook";
}

function isAudiobookEdition(
  edition: BookEdition,
): edition is BookEdition & { chapters: ListeningChapter[] } {
  return edition.format === "audiobook";
}

/**
 * `[id]` is the book's `slug` (matching `/store/[slug]`'s convention — the
 * `Book` fixture has no separate numeric id field) — a judgment call since
 * the route segment is named `id` in the plan's site map but the only
 * lookup key `lib/mock-books.ts` exposes is `slug`.
 */
function resolveChapterIdx(
  searchParams: ReaderPageSearchParams,
  totalChapters: number,
): number {
  const raw = Array.isArray(searchParams.chapter)
    ? searchParams.chapter[0]
    : searchParams.chapter;
  const parsed = raw ? Number(raw) : 0;
  if (!Number.isInteger(parsed) || parsed < 0 || parsed >= totalChapters) {
    return 0;
  }
  return parsed;
}

export async function generateMetadata({
  params,
}: ReaderPageProps): Promise<Metadata> {
  const { id } = await params;
  const book = findBookBySlug(id);
  if (!book) return {};
  return {
    title: `${book.title} — Reader`,
    description: book.description,
  };
}

/**
 * `/dashboard/books/[id]/read` — Figma "The Book" frame.
 *
 * Pagination judgment call: the plan describes cycling through "the
 * fixture's pre-chunked page array" (§9 item 10), but `lib/mock-books.ts`'s
 * `ReadingChapter` has no such sub-chapter page array — each chapter is
 * already the smallest pre-chunked unit the fixture offers. So here, one
 * "page" = one chapter: `PaginationBar` shows "Page {idx+1} out of
 * {totalChapters}" and Previous/Next navigate between chapters via the
 * `?chapter=` search param (matching `GET /api/reader/chapter`'s
 * `prevIdx`/`nextIdx`/`totalChapters` shape) rather than a scroll-position
 * or real-reflow scheme.
 */
export default async function ReaderPage({
  params,
  searchParams,
}: ReaderPageProps) {
  const { id } = await params;
  const sp = await searchParams;

  const book = findBookBySlug(id);
  if (!book) notFound();

  const ebookEdition = book.editions.find(isEbookEdition);
  const audioEdition = book.editions.find(isAudiobookEdition);

  // The reader page requires readable text — a book with only an audiobook
  // edition has nothing for this page to render.
  if (!ebookEdition) notFound();

  const totalChapters = ebookEdition.chapters.length;
  const chapterIdx = resolveChapterIdx(sp, totalChapters);
  const chapter = ebookEdition.chapters[chapterIdx];
  const audioChapter = audioEdition?.chapters.find((c) => c.idx === chapterIdx);

  const readMinutes = Math.max(
    1,
    Math.round(
      ebookEdition.chapters.reduce((sum, c) => sum + c.wordCount, 0) / 200,
    ),
  );

  // Captured as a plain string (rather than referencing `book` directly)
  // since TypeScript doesn't retain narrowing from the `notFound()` guard
  // above across a nested function closure.
  const bookSlug = book.slug;
  function hrefForPage(page: number) {
    return `/dashboard/books/${bookSlug}/read?chapter=${page - 1}`;
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <ReaderTopbar
          title={`Home > My Books > ${book.title}`}
          subtitle={chapter.title}
          progressPercent={((chapterIdx + 1) / totalChapters) * 100}
          rightSlot={
            <ReaderHeaderActions
              editionId={ebookEdition.id}
              chapterIdx={chapterIdx}
              readers={[
                { alt: book.author },
                { alt: "Reader" },
                { alt: "Reader" },
              ]}
            />
          }
        />

        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-10 px-6 py-10 lg:flex-row lg:items-start lg:px-10">
          <main className="flex min-w-0 flex-1 flex-col">
            <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-display text-3xl leading-tight text-navy sm:text-4xl">
                  {chapter.title}
                </h1>
                {audioChapter && audioEdition && (
                  <ListenButton editionId={audioEdition.id} chapter={audioChapter} />
                )}
              </div>

              {/* Prose column convention matches the store excerpt card
                  (app/(marketing)/store/[slug]/page.tsx): constrained width,
                  relaxed leading, whitespace preserved for the fixture's
                  paragraph breaks. */}
              <p className="text-base leading-relaxed whitespace-pre-line text-navy/80">
                {chapter.content}
              </p>
            </div>

            <PaginationBar
              currentPage={chapterIdx + 1}
              totalPages={totalChapters}
              hrefForPage={hrefForPage}
              className="mx-auto w-full max-w-2xl"
            />
          </main>

          <BookMetaPanel
            title={book.title}
            author={book.author}
            rating={book.rating}
            reviewCount={book.reviewCount}
            blurb={book.description}
            stats={[
              { icon: <BookOpenIcon />, count: totalChapters, label: "chapters" },
              { icon: <ClockIcon />, count: `${readMinutes} min`, label: "read" },
            ]}
            className="lg:w-72"
          />
        </div>
      </div>

      <ReadingProgressTracker editionId={ebookEdition.id} chapterIdx={chapterIdx} />
    </div>
  );
}
