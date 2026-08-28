import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Book } from "@/lib/mock-books";

export interface BookPromoBannerProps {
  /** Conforms to `lib/mock-books.ts`'s `Book` shape — no parallel type. */
  book: Book;
  /**
   * Short marketing blurb for the banner. Distinct from `book.description`/
   * `book.longDescription` (which are catalog copy) — this is banner-only
   * copy, so it's a separate prop rather than a new `Book` field.
   */
  blurb?: string;
  /**
   * Optional "was" price for the struck-through discount treatment. Left
   * unset by default: `Book` has no compare-at-price field in the fixture,
   * and inventing one would mean displaying a price that doesn't match
   * `book.price` anywhere else the book is shown. Pass it explicitly when a
   * real promo price exists.
   */
  compareAtPrice?: number;
  /**
   * Explicit cover image override. NOT read from `book.cover` automatically
   * — the fixture's `cover` field is a contract path for where the asset
   * will live, but no actual file has been exported from Figma yet (see
   * the plan's §8), so defaulting to it would render a broken image. Pass
   * this once real cover art exists.
   */
  coverImageSrc?: string;
  ctaLabel?: string;
  className?: string;
}

function formatPrice(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString()}`;
}

/**
 * Large rounded promo card for a book — used on the Home page and reusable
 * on the Book Preview page. Takes the real `Book` shape from
 * `lib/mock-books.ts` so both call sites share one source of truth for
 * title/price/slug.
 */
export function BookPromoBanner({
  book,
  blurb,
  compareAtPrice,
  coverImageSrc,
  ctaLabel = "Get Your Copy Now",
  className,
}: BookPromoBannerProps) {
  const [firstWord, ...rest] = book.title.split(" ");
  const lastWord = rest.pop();
  const middleWords = rest.join(" ");

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card text-cream",
        className,
      )}
      style={{
        background:
          "linear-gradient(115deg, var(--color-navy) 0%, #123a6b 100%)",
      }}
    >
      <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center lg:gap-16 lg:p-16">
        <div className="flex flex-col gap-6 lg:order-1">
          <h2 className="font-display text-4xl leading-tight sm:text-5xl">
            {firstWord} {middleWords && `${middleWords} `}
            <span className="text-gold-bright">{lastWord}</span>
          </h2>

          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-semibold text-gold-bright">
              {formatPrice(book.price, book.currency)}
            </span>
            {compareAtPrice && compareAtPrice > book.price && (
              <span className="text-base text-cream/40 line-through">
                {formatPrice(compareAtPrice, book.currency)}
              </span>
            )}
          </div>

          <p className="max-w-md text-sm leading-relaxed text-cream/75 sm:text-base">
            {blurb ?? book.description}
          </p>

          <div>
            {/*
              `Button` (components/ui/Button.tsx) only renders a <button>,
              not an anchor, so a real navigable link here mirrors its
              "secondary" (gold) variant + "lg" size classes directly rather
              than nesting an <a> inside a <button>.
            */}
            <Link
              href={`/store/${book.slug}`}
              className="mt-2 inline-flex h-13 items-center justify-center gap-2.5 rounded-full bg-gold px-8 text-lg font-medium tracking-tight text-navy transition-colors duration-150 hover:bg-gold-bright"
            >
              {ctaLabel}
            </Link>
          </div>
        </div>

        <div className="relative order-first mx-auto aspect-[3/4] w-full max-w-[280px] lg:order-2 lg:mx-0 lg:ml-auto lg:max-w-none">
          <div className="absolute inset-0 rounded-l-card rounded-r-[2.5rem] border-2 border-gold bg-navy/60 p-2">
            <div className="relative h-full w-full overflow-hidden rounded-l-[1.1rem] rounded-r-[2.1rem] bg-navy">
              {coverImageSrc ? (
                <Image
                  src={coverImageSrc}
                  alt={`${book.title} cover`}
                  fill
                  sizes="(min-width: 1024px) 360px, 70vw"
                  className="object-cover"
                />
              ) : (
                // Placeholder — no cover art exported from Figma yet.
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-navy to-[#081527] p-6 text-center">
                  <span className="font-display text-lg text-gold-bright">
                    {book.title}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
