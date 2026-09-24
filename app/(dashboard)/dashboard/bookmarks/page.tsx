import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { Card, SectionHeading } from "@/components/ui";
import { BookmarkIcon } from "@/components/layout/icons";
import { findEditionById } from "@/lib/mock-books";
import { listBookmarks } from "@/lib/server/mock-bookmarks-store";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";

export const metadata: Metadata = {
  title: "My Bookmarks — Felister Wangechi Kariuki",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * `/dashboard/bookmarks` — no dedicated Figma frame (see build brief).
 *
 * Data-shape judgment call: `GET /api/bookmarks` (already built) is backed
 * by `lib/server/mock-bookmarks-store.ts`'s `Bookmark` shape — `{ id,
 * userId, editionId, bookSlug, chapterIdx, position, note?, createdAt }`,
 * where `position` is a 0–1 float (fraction through the chapter), not a
 * page/character offset. This page reads that store directly (same
 * server-side-fixture convention as the rest of `/dashboard`) rather than
 * fetching the session-gated route, and resolves each bookmark's book title
 * + chapter title by joining against `lib/mock-books.ts`.
 */
export default function DashboardBookmarksPage() {
  const bookmarks = listBookmarks(CURRENT_USER_ID);

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <SectionHeading as="h1" eyebrow="Saved spots">
        My Bookmarks
      </SectionHeading>

      {bookmarks.length === 0 ? (
        <EmptyState message="No bookmarks yet — save a spot while reading or listening to see it here." />
      ) : (
        <div className="flex flex-col gap-4">
          {bookmarks.map((bookmark) => {
            const found = findEditionById(bookmark.editionId);
            const chapter = found?.edition.chapters.find(
              (c) => c.idx === bookmark.chapterIdx,
            );

            const href = `/dashboard/books/${bookmark.bookSlug}/read?editionId=${bookmark.editionId}&idx=${bookmark.chapterIdx}&position=${bookmark.position}`;

            return (
              <Card key={bookmark.id} padding="md" as="article">
                <Link href={href} className="flex items-start gap-4">
                  <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                    <BookmarkIcon className="size-4.5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <h3 className="font-display text-base text-navy">
                        {found?.book.title ?? bookmark.bookSlug}
                      </h3>
                      <span className="text-xs text-gray">
                        {formatDate(bookmark.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-gray">
                      {chapter?.title ?? `Chapter ${bookmark.chapterIdx + 1}`}
                      {" · "}
                      {Math.round(bookmark.position * 100)}% through
                    </p>
                    {bookmark.note && (
                      <p className="mt-1 line-clamp-2 text-sm text-navy/80 italic">
                        &ldquo;{bookmark.note}&rdquo;
                      </p>
                    )}
                  </div>
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
