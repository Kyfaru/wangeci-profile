import Link from "next/link";
import { cn } from "@/lib/cn";

interface ReaderPagerProps {
  baseHref: string;
  editionId: string;
  prevIdx: number | null;
  nextIdx: number | null;
  chapterIdx: number;
  totalChapters: number;
}

/**
 * Prev/next bar (Figma: "The Book" frame). Figma shows "Page 50 out of 200",
 * but there's no word-level pagination data in the mock chapters (only up to
 * idx 5) — using chapter position instead of inventing a fake page count.
 */
export function ReaderPager({ baseHref, editionId, prevIdx, nextIdx, chapterIdx, totalChapters }: ReaderPagerProps) {
  const hrefFor = (idx: number) => `${baseHref}?editionId=${editionId}&idx=${idx}`;
  const navClass = "font-display text-lg";

  return (
    <div className="sticky bottom-0 flex items-center justify-between border-t border-black/10 bg-cream px-8 py-6 md:px-16">
      {prevIdx !== null ? (
        <Link href={hrefFor(prevIdx)} className={cn(navClass, "text-gold hover:opacity-70")}>
          {"< Previous"}
        </Link>
      ) : (
        <span className={cn(navClass, "text-black/20")}>{"< Previous"}</span>
      )}

      <p className="font-display text-black">
        Chapter <span className="text-gold">{chapterIdx + 1}</span> of {totalChapters}
      </p>

      {nextIdx !== null ? (
        <Link href={hrefFor(nextIdx)} className={cn(navClass, "text-gold hover:opacity-70")}>
          {"Next >"}
        </Link>
      ) : (
        <span className={cn(navClass, "text-black/20")}>{"Next >"}</span>
      )}
    </div>
  );
}
