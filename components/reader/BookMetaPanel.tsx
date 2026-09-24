import type { ReactNode } from "react";
import { RatingBadge, StatChip } from "@/components/ui";
import { cn } from "@/lib/cn";

export interface BookMetaPanelStat {
  icon: ReactNode;
  count: string | number;
  label?: string;
}

export interface BookMetaPanelProps {
  title: string;
  author: string;
  rating: number;
  reviewCount: number;
  blurb: string;
  stats: BookMetaPanelStat[];
  className?: string;
}

/**
 * Reader-page-exclusive right rail: cover placeholder, title/author,
 * rating + stat chips, and a short blurb. `position: sticky` (not `fixed`)
 * per the plan's kept frontend pattern, so it scrolls away with the rest of
 * the page instead of pinning over content on short viewports.
 */
export function BookMetaPanel({
  title,
  author,
  rating,
  reviewCount,
  blurb,
  stats,
  className,
}: BookMetaPanelProps) {
  return (
    <aside
      className={cn(
        "sticky top-0 flex w-full shrink-0 flex-col gap-5 self-start px-6 py-8 lg:px-0",
        className,
      )}
    >
      {/* Cover placeholder — no real cover asset exists yet (see `book.cover`
          in lib/mock-books.ts for the eventual asset path); same treatment
          as the store's Book Preview page for visual consistency. */}
      <div className="aspect-3/4 w-full overflow-hidden rounded-card border border-gold/30 bg-linear-to-br from-navy via-navy to-navy/80 shadow-lg">
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <span className="text-[11px] font-semibold tracking-[0.2em] text-gold-bright uppercase">
            {author}
          </span>
          <div className="h-px w-8 bg-gold/40" />
          <span className="font-display text-lg leading-snug text-cream">
            {title}
          </span>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl text-navy">{title}</h2>
        <p className="mt-1 text-sm text-gray">{author}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RatingBadge rating={rating} count={reviewCount} size="sm" />
        {stats.map((stat, i) => (
          <StatChip
            key={i}
            icon={stat.icon}
            count={stat.count}
            label={stat.label}
            variant="gold"
          />
        ))}
      </div>

      <p className="text-sm leading-relaxed text-navy/70">{blurb}</p>
    </aside>
  );
}
