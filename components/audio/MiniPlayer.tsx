"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { usePlayerStore } from "@/lib/stores/player-store";

/** Small bar shown on other dashboard pages while an audiobook is loaded, so playback can be controlled anywhere. */
export function MiniPlayer() {
  const pathname = usePathname();
  const { src, slug, bookTitle, chapters, chapterIdx, status } = usePlayerStore();
  if (!src || !slug || pathname.endsWith("/listen")) return null;
  const title = chapters.find((c) => c.idx === chapterIdx)?.title ?? bookTitle;
  const playing = status === "playing";

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t border-black/10 bg-cream/95 px-4 py-3 backdrop-blur md:left-[347px]">
      <button
        type="button"
        onClick={() => usePlayerStore.getState().toggle()}
        aria-label={playing ? "Pause" : "Play"}
        aria-pressed={playing}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-cream"
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
          {playing ? <path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <path d="M8 5v14l11-7z" />}
        </svg>
      </button>
      <Link href={`/dashboard/books/${slug}/listen`} className="min-w-0 flex-1 truncate text-sm text-black hover:underline">
        <span className="font-medium">{bookTitle}</span> · {title}
      </Link>
    </div>
  );
}
