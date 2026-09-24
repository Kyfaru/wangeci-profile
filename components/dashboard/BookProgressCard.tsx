"use client";

import type { MouseEvent } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { usePlayerStore } from "@/lib/stores/player-store";
import { BookmarkIcon, PlayIcon } from "@/components/layout/icons";
import { ProgressBar, RatingBadge, StatChip } from "@/components/ui";
import { EyeIcon, HeadphoneIcon } from "./icons";

export type BookProgressCardVariant = "reading" | "listening";

export interface BookProgressCardProps {
  href: string;
  title: string;
  author: string;
  rating: number;
  /** Placeholder engagement stat — no view-count fixture exists yet (see
   * the report), so callers pass `book.reviewCount` as the closest real
   * numeric signal in `lib/mock-books.ts`. */
  viewCount: number;
  bookmarkCount: number;
  progressPercent: number;
  variant?: BookProgressCardVariant;
  /** Listening-only playback wiring — plain serializable data (not a
   * callback) so a server component page can still pass it straight
   * through to this client component. Ignored for variant="reading". */
  audioUrl?: string;
  editionId?: string;
  chapterIdx?: number;
  durationSeconds?: number;
  className?: string;
}

/**
 * Book cover + progress card used by the "Continue Reading" / "Continue
 * Listening" dashboard sections (and reused as a plain library-item card on
 * `/dashboard/books`). Cover art is a placeholder block (no real cover
 * assets exist yet — see `BookCard`'s identical convention on `/store`).
 */
export function BookProgressCard({
  href,
  title,
  author,
  rating,
  viewCount,
  bookmarkCount,
  progressPercent,
  variant = "reading",
  audioUrl,
  editionId,
  chapterIdx,
  durationSeconds,
  className,
}: BookProgressCardProps) {
  const loadTrack = usePlayerStore((s) => s.loadTrack);
  const isListening = variant === "listening";
  const canPlay = isListening && !!audioUrl && !!editionId;

  function handlePlay(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canPlay || !audioUrl || !editionId) return;
    loadTrack({
      editionId,
      chapterIdx: chapterIdx ?? 0,
      audioUrl,
      duration: durationSeconds ?? 0,
    });
  }

  return (
    <Link
      href={href}
      className={cn(
        "group flex w-full flex-col overflow-hidden rounded-card border border-navy/10 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md",
        className,
      )}
    >
      {/* Cover placeholder — no real cover asset exists yet; see
          `book.cover` in lib/mock-books.ts for the eventual asset path. */}
      <div className="relative aspect-3/4 w-full overflow-hidden bg-linear-to-br from-navy to-navy/80">
        <div
          className="absolute -top-6 -right-6 size-24 rounded-full bg-gold-bright/25 blur-2xl"
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <span className="font-display text-base leading-snug text-cream">
            {title}
          </span>
        </div>
        {canPlay && (
          <button
            type="button"
            onClick={handlePlay}
            aria-label={`Play ${title}`}
            className="absolute right-3 bottom-3 inline-flex size-9 items-center justify-center rounded-full bg-gold-bright text-navy shadow-md transition-transform hover:scale-105"
          >
            <PlayIcon className="size-4 translate-x-px" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-1 font-display text-base leading-snug text-navy transition-colors group-hover:text-gold">
          {title}
        </h3>
        <p className="text-xs text-gray">{author}</p>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <RatingBadge rating={rating} size="sm" />
          <StatChip
            icon={isListening ? <HeadphoneIcon /> : <EyeIcon />}
            count={viewCount}
          />
          <StatChip icon={<BookmarkIcon />} count={bookmarkCount} />
        </div>

        <ProgressBar
          value={progressPercent}
          variant={isListening ? "green" : "gold"}
          size="sm"
          showValue
          className="mt-auto pt-2"
        />
      </div>
    </Link>
  );
}
