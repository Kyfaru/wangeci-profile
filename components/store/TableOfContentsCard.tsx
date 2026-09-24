import { cn } from "@/lib/cn";

export interface TableOfContentsEntry {
  idx: number;
  title: string;
}

export interface TableOfContentsCardProps {
  chapters: TableOfContentsEntry[];
  className?: string;
}

/**
 * Tinted-cream card listing numbered chapter titles, per the Figma "Book
 * Preview" frame (flat "N. Title" list, no per-row card/border — not
 * `components/ui/Card`, whose fixed white fill doesn't match the frame's
 * `rgba(230,224,212,0.95)` tint). Accepts anything with `{ idx, title }` so
 * it works for both `ReadingChapter[]` and `ListeningChapter[]` from
 * `lib/mock-books.ts`.
 */
export function TableOfContentsCard({
  chapters,
  className,
}: TableOfContentsCardProps) {
  return (
    <div
      className={cn(
        "h-fit rounded-card bg-[#e6e0d4]/95 p-8 sm:p-10",
        className,
      )}
    >
      <h2 className="text-center font-display text-2xl text-navy sm:text-3xl">
        Table Of Content
      </h2>
      <ol className="mt-8 flex flex-col gap-5">
        {chapters.map((chapter, i) => (
          <li key={chapter.idx} className="text-lg text-navy/70 sm:text-xl">
            {i + 1}. {chapter.title}
          </li>
        ))}
      </ol>
    </div>
  );
}
