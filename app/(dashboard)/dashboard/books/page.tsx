import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ContinueCard } from "@/components/dashboard/ContinueCard";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";
import { findBookBySlug } from "@/lib/mock-books";
import { getLibraryForUser, type LibraryFormat, type LibraryItem } from "@/lib/mock-user";
import { listBookmarks } from "@/lib/server/mock-bookmarks-store";

export const metadata: Metadata = { title: "My Books — Felister Wangechi Kariuki" };

/** "My dashboard" Figma frame: Continue Reading / Continue Listening. */
export default function DashboardBooksPage() {
  const library = getLibraryForUser(CURRENT_USER_ID).filter((i) => i.status !== "completed");

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        <Section
          heading="Continue Reading"
          icon="fluent--reading-list-20-filled"
          items={library}
          format="ebook"
          statIcon="akar-icons--eye"
        />
        <Section
          heading="Continue Listening"
          icon="hugeicons--audio-wave-02"
          items={library}
          format="audiobook"
          statIcon="fluent--headphones-sound-wave-48-filled"
          className="mt-16"
        />
      </div>
    </>
  );
}

function Section({
  heading,
  icon,
  items,
  format,
  statIcon,
  className,
}: {
  heading: string;
  icon: string;
  items: LibraryItem[];
  format: LibraryFormat;
  statIcon: string;
  className?: string;
}): ReactNode {
  const filtered = items.filter((i) => i.format === format);
  if (filtered.length === 0) return null;

  return (
    <section className={className}>
      <h2 className="flex items-center gap-3 text-4xl font-medium text-black">
        {heading}
        <MaskIcon name={icon} size={36} />
      </h2>
      <div className="mt-6 flex gap-6 overflow-x-auto pb-2">
        {filtered.map((item, i) => {
          const book = findBookBySlug(item.bookSlug);
          if (!book) return null;
          const bookmarkCount = listBookmarks(CURRENT_USER_ID, item.editionId).length;

          return (
            <ContinueCard
              key={item.id}
              slug={item.bookSlug}
              editionId={item.editionId}
              chapterIdx={item.currentChapterIdx}
              title={book.title}
              author={book.author}
              cover={book.cover}
              rating={book.rating}
              statIcon={statIcon}
              statCount={book.reviewCount}
              bookmarkCount={bookmarkCount}
              progressPercent={item.progressPercent}
              variant={format === "ebook" ? "reading" : "listening"}
              priority={i === 0}
            />
          );
        })}
      </div>
    </section>
  );
}
