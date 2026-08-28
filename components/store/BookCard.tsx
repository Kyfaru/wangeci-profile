import Link from "next/link";
import { cn } from "@/lib/cn";
import { RatingBadge } from "@/components/ui";
import type { Book } from "@/lib/mock-books";

export interface BookCardProps {
  book: Book;
  className?: string;
}

/**
 * Catalog card for `/store` — cover placeholder, title, author, price, and
 * a `RatingBadge`, linking to the book's `/store/[slug]` preview page.
 */
export function BookCard({ book, className }: BookCardProps) {
  return (
    <Link
      href={`/store/${book.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-navy/10 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md",
        className,
      )}
    >
      {/* Cover placeholder — no real cover asset exists yet; see `book.cover`
          in lib/mock-books.ts for the eventual asset path. */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-linear-to-br from-navy to-navy/80">
        <div
          className="absolute -top-6 -right-6 size-24 rounded-full bg-gold-bright/25 blur-2xl"
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <span className="font-display text-lg leading-snug text-cream">
            {book.title}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-display text-lg leading-snug text-navy transition-colors group-hover:text-gold">
          {book.title}
        </h3>
        <p className="text-sm text-gray">{book.author}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-sm font-semibold text-navy">
            {book.currency} {book.price.toLocaleString()}
          </span>
          <RatingBadge rating={book.rating} size="sm" />
        </div>
      </div>
    </Link>
  );
}
