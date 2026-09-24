import type { Metadata } from "next";
import { BookProgressCard } from "@/components/dashboard/BookProgressCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { SectionHeading } from "@/components/ui";
import {
  findBookBySlug,
  findEditionById,
  type ListeningChapter,
} from "@/lib/mock-books";
import { getLibraryForUser } from "@/lib/mock-user";
import { listBookmarks } from "@/lib/server/mock-bookmarks-store";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";

export const metadata: Metadata = {
  title: "Dashboard — Felister Wangechi Kariuki",
};

function readerHref(bookSlug: string, editionId: string, chapterIdx: number) {
  return `/dashboard/books/${bookSlug}/read?editionId=${editionId}&idx=${chapterIdx}`;
}

/**
 * `/dashboard` — Figma "My Dashboard" frame. Server component: reads the
 * fixtures directly (see `lib/dashboard/current-user.ts` for why this
 * doesn't round-trip through the session-gated `GET /api/user/library`
 * mock route from here), mirroring the convention in
 * `app/(marketing)/store/[slug]/page.tsx`.
 */
export default function DashboardPage() {
  const library = getLibraryForUser(CURRENT_USER_ID);

  const reading = library.filter(
    (item) => item.format === "ebook" && item.status !== "completed",
  );
  const listening = library.filter((item) => item.format === "audiobook");

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12">
      <section className="flex flex-col gap-5">
        <SectionHeading as="h1" eyebrow="Pick up where you left off">
          Continue Reading
        </SectionHeading>

        {reading.length === 0 ? (
          <EmptyState message="No ebooks in progress yet — browse the store to start one." />
        ) : (
          <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
            {reading.map((item) => {
              const book = findBookBySlug(item.bookSlug);
              if (!book) return null;
              const bookmarkCount = listBookmarks(
                CURRENT_USER_ID,
                item.editionId,
              ).length;

              return (
                <div key={item.id} className="w-64 shrink-0 snap-start">
                  <BookProgressCard
                    variant="reading"
                    href={readerHref(
                      item.bookSlug,
                      item.editionId,
                      item.currentChapterIdx,
                    )}
                    title={book.title}
                    author={book.author}
                    rating={book.rating}
                    viewCount={book.reviewCount}
                    bookmarkCount={bookmarkCount}
                    progressPercent={item.progressPercent}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <SectionHeading as="h2" eyebrow="Keep going">
          Continue Listening
        </SectionHeading>

        {listening.length === 0 ? (
          <EmptyState message="No audiobooks in your library yet." />
        ) : (
          <div className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-2">
            {listening.map((item) => {
              const book = findBookBySlug(item.bookSlug);
              const found = findEditionById(item.editionId);
              if (!book || !found) return null;

              const chapters = found.edition.chapters as ListeningChapter[];
              const currentChapter =
                chapters[item.currentChapterIdx] ?? chapters[0];
              const bookmarkCount = listBookmarks(
                CURRENT_USER_ID,
                item.editionId,
              ).length;

              return (
                <div key={item.id} className="w-64 shrink-0 snap-start">
                  <BookProgressCard
                    variant="listening"
                    href={readerHref(
                      item.bookSlug,
                      item.editionId,
                      item.currentChapterIdx,
                    )}
                    title={book.title}
                    author={book.author}
                    rating={book.rating}
                    viewCount={book.reviewCount}
                    bookmarkCount={bookmarkCount}
                    progressPercent={item.progressPercent}
                    audioUrl={currentChapter?.audioUrl}
                    editionId={item.editionId}
                    chapterIdx={item.currentChapterIdx}
                    durationSeconds={currentChapter?.durationSeconds}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
