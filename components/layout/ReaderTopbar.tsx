"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { ProgressBar } from "@/components/ui";
import { ArrowLeftIcon } from "./icons";

export interface ReaderTopbarProps {
  /** Book/edition title, shown centered. */
  title: string;
  /** e.g. "Chapter 3 · Letters to the Woman Rebuilding". Shown under the title. */
  subtitle?: string;
  /** Called instead of the default `router.back()` when the exit control is pressed. */
  onBack?: () => void;
  /** 0-100. When provided, renders a slim progress strip under the bar. */
  progressPercent?: number;
  /** Extra controls on the right, e.g. a font-size toggle — kept generic
   * since the reading page's exact controls aren't this component's job. */
  rightSlot?: ReactNode;
  className?: string;
}

/**
 * Minimal top bar for the immersive reading experience — just an exit
 * control, the title, and an optional progress strip. Deliberately kept
 * light so it doesn't compete with the reading surface itself.
 */
export function ReaderTopbar({
  title,
  subtitle,
  onBack,
  progressPercent,
  rightSlot,
  className,
}: ReaderTopbarProps) {
  const router = useRouter();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-navy/10 bg-cream/95 backdrop-blur",
        className,
      )}
    >
      <div className="flex h-16 items-center gap-4 px-4 lg:px-8">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : router.back())}
          aria-label="Exit reader"
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-navy hover:bg-navy/5"
        >
          <ArrowLeftIcon className="size-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-display text-base text-navy sm:text-lg">
            {title}
          </p>
          {subtitle && (
            <p className="truncate text-xs text-gray">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">{rightSlot}</div>
      </div>

      {progressPercent !== undefined && (
        <ProgressBar
          value={progressPercent}
          size="sm"
          variant="gold"
          className="px-4 pb-2 lg:px-8"
        />
      )}
    </header>
  );
}
