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
  title: "My Books — Felister Wangechi Kariuki",
};

function readerHref(bookSlug: string, editionId: string, chapterIdx: number) {
  return `/dashboard/books/${bookSlug}/read?editionId=${editionId}&idx=${chapterIdx}`;
}

/**
 * `/dashboard/books` — every edition in the user's library (all formats,
 * all statuses), newest-updated first. No dedicated Figma frame for this
 * sub-page (see build brief) — reuses `BookProgressCard` in a responsive
 * grid rather than the dashboard home's horizontal scroller, since a full
 * listing benefits more from scanning than scrolling.
 */
export default function DashboardBooksPage() {
  const library = [...getLibraryForUser(CURRENT_USER_ID)].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6">
      <SectionHeading as="h1" eyebrow="Your library">
        My Books
      </SectionHeading>

      {library.length === 0 ? (
        <EmptyState message="Your library is empty — browse the store to add a book." />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {library.map((item) => {
            const book = findBookBySlug(item.bookSlug);
            if (!book) return null;

            const bookmarkCount = listBookmarks(
              CURRENT_USER_ID,
              item.editionId,
            ).length;

            const isListening = item.format === "audiobook";
            let audioUrl: string | undefined;
            let durationSeconds: number | undefined;
            if (isListening) {
              const found = findEditionById(item.editionId);
              const chapters = found?.edition.chapters as
                | ListeningChapter[]
                | undefined;
              const currentChapter =
                chapters?.[item.currentChapterIdx] ?? chapters?.[0];
              audioUrl = currentChapter?.audioUrl;
              durationSeconds = currentChapter?.durationSeconds;
            }

            return (
              <BookProgressCard
                key={item.id}
                variant={isListening ? "listening" : "reading"}
                className="w-full"
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
                audioUrl={audioUrl}
                editionId={isListening ? item.editionId : undefined}
                chapterIdx={item.currentChapterIdx}
                durationSeconds={durationSeconds}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
