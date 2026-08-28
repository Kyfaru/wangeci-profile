import { Card } from "@/components/ui";
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
 * Rounded card listing numbered chapter titles, per the Figma "Book
 * Preview" frame. Accepts anything with `{ idx, title }` so it works for
 * both `ReadingChapter[]` and `ListeningChapter[]` from `lib/mock-books.ts`.
 */
export function TableOfContentsCard({
  chapters,
  className,
}: TableOfContentsCardProps) {
  return (
    <Card padding="lg" className={cn("h-fit", className)}>
      <h2 className="font-display text-2xl text-navy">Table Of Content</h2>
      <ol className="mt-6 flex flex-col">
        {chapters.map((chapter, i) => (
          <li
            key={chapter.idx}
            className="flex items-baseline gap-4 border-b border-navy/5 py-3 last:border-b-0"
          >
            <span className="font-display text-lg text-gold shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="text-base text-navy/80">{chapter.title}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
