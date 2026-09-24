import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Book } from "@/lib/mock-books";

export interface ShareCardProps {
  book: Book;
  quote: string;
  sharedBy: string;
  className?: string;
}

/**
 * Single centered card for `/share/[id]` — a shared book highlight (cover
 * placeholder, a pulled quote, who shared it, and a CTA back to the book's
 * store page). No real "share" data model exists yet (see the `/share/[id]`
 * page for the inline fixture shape this reads) — this component only
 * needs `book` + `quote` + `sharedBy`, so it stays agnostic of how a real
 * share/referral record would eventually be shaped.
 */
export function ShareCard({ book, quote, sharedBy, className }: ShareCardProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-lg flex-col items-center gap-8 rounded-card bg-white p-8 text-center shadow-xl sm:p-12",
        className,
      )}
    >
      {/* Cover placeholder — no real cover asset exists yet; see
          `book.cover` in lib/mock-books.ts for the eventual asset path. */}
      <div className="relative aspect-3/4 w-40 overflow-hidden rounded-card border border-gold/30 bg-linear-to-br from-navy via-navy to-navy/80 shadow-lg">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-gold-bright uppercase">
            {book.author}
          </span>
          <div className="h-px w-6 bg-gold/40" />
          <span className="font-display text-sm leading-snug text-cream">
            {book.title}
          </span>
        </div>
      </div>

      <blockquote className="flex flex-col gap-4">
        <p className="font-display text-2xl leading-snug text-navy sm:text-3xl">
          &ldquo;{quote}&rdquo;
        </p>
        <footer className="text-sm font-semibold tracking-[0.1em] text-gold uppercase">
          Shared by {sharedBy}
        </footer>
      </blockquote>

      <Link
        href={`/store/${book.slug}`}
        className="inline-flex h-13 w-full items-center justify-center rounded-full bg-navy px-8 text-lg font-medium tracking-tight text-cream transition-colors duration-150 hover:bg-navy/90 sm:w-auto"
      >
        Get Your Copy Now
      </Link>
    </div>
  );
}
