import Link from "next/link";
import { cn } from "@/lib/cn";

export interface PaginationBarProps {
  /** 1-indexed current page. */
  currentPage: number;
  totalPages: number;
  /** Builds the href for a given 1-indexed page number. */
  hrefForPage: (page: number) => string;
  className?: string;
}

/**
 * Print-style pagination bar for the reader — "< Previous / Page N out of M
 * / Next >". Per the plan (build-order step 12, §9 item 10) this is
 * deliberately mocked over reflowable text: each "page" is one pre-chunked
 * unit from the fixture (here, one chapter — see the reader page's judgment
 * call note), not a real reflow/pagination engine. Plain `<Link>`s so the
 * page works without client JS and survives a hard refresh via the URL.
 */
export function PaginationBar({
  currentPage,
  totalPages,
  hrefForPage,
  className,
}: PaginationBarProps) {
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <nav
      aria-label="Chapter pagination"
      className={cn(
        "flex items-center justify-between gap-4 border-t border-navy/10 py-6",
        className,
      )}
    >
      {hasPrev ? (
        <Link
          href={hrefForPage(currentPage - 1)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
        >
          <span aria-hidden="true">&larr;</span> Previous
        </Link>
      ) : (
        <span className="w-24" aria-hidden="true" />
      )}

      <p className="text-sm text-gray">
        Page {currentPage} out of {totalPages}
      </p>

      {hasNext ? (
        <Link
          href={hrefForPage(currentPage + 1)}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-navy transition-colors hover:bg-navy/5"
        >
          Next <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : (
        <span className="w-24" aria-hidden="true" />
      )}
    </nav>
  );
}
