"use client";

import { useEffect } from "react";
import { useReaderStore, useReadingProgressSync } from "@/lib/stores/reader-store";

export interface ReadingProgressTrackerProps {
  editionId: string;
  chapterIdx: number;
}

/**
 * Mounts the reader page's position sync. Renders nothing — purely wires
 * `useReaderStore` + the already-built `useReadingProgressSync` hook (30s
 * interval + `beforeunload` sendBeacon, both defined in
 * lib/stores/reader-store.ts) to this page's current editionId/chapterIdx.
 * Does not reimplement the sync loop itself.
 */
export function ReadingProgressTracker({
  editionId,
  chapterIdx,
}: ReadingProgressTrackerProps) {
  const setPosition = useReaderStore((s) => s.setPosition);
  useReadingProgressSync();

  // Push the current page's position into the store whenever the reader
  // navigates to a different chapter/page (each "page" here is a full
  // navigation via PaginationBar's <Link>, so this remounts/reruns cleanly).
  useEffect(() => {
    setPosition({ editionId, chapterIdx, scrollPosition: 0, charPosition: 0 });
  }, [editionId, chapterIdx, setPosition]);

  // Lightweight scroll-fraction tracking for the position payload's
  // `scrollPosition` field — a real reflow engine isn't in scope (see
  // PaginationBar's doc comment), but tracking how far down the current
  // chapter's rendered text the reader has scrolled is cheap and matches
  // the store's documented shape.
  useEffect(() => {
    function onScroll() {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - doc.clientHeight;
      const fraction = scrollable > 0 ? window.scrollY / scrollable : 0;
      setPosition({ scrollPosition: Math.min(1, Math.max(0, fraction)) });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [setPosition]);

  return null;
}
