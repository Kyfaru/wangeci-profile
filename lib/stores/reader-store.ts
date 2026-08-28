"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { API_BASE_URL } from "@/lib/api/client";

export interface ReaderPosition {
  editionId: string | null;
  chapterIdx: number;
  /** 0–1 scroll fraction through the current chapter. */
  scrollPosition: number;
  /** Character offset into the chapter's rendered text, for fine resume. */
  charPosition: number;
}

interface ReaderState extends ReaderPosition {
  setPosition: (position: Partial<ReaderPosition>) => void;
  reset: () => void;
}

const INITIAL_POSITION: ReaderPosition = {
  editionId: null,
  chapterIdx: 0,
  scrollPosition: 0,
  charPosition: 0,
};

/**
 * In-memory only — not persisted to localStorage. The server-side
 * `/api/reading/progress` record (synced by useReadingProgressSync below) is
 * the source of truth for resuming across sessions/devices; this store just
 * holds the live position while the reader is open.
 */
export const useReaderStore = create<ReaderState>()((set) => ({
  ...INITIAL_POSITION,
  setPosition: (position) => set(position),
  reset: () => set(INITIAL_POSITION),
}));

interface ProgressPayload extends ReaderPosition {
  timestamp: number;
}

function buildProgressPayload(): ProgressPayload | null {
  const { editionId, chapterIdx, scrollPosition, charPosition } =
    useReaderStore.getState();
  if (!editionId) return null;
  return { editionId, chapterIdx, scrollPosition, charPosition, timestamp: Date.now() };
}

const PROGRESS_SYNC_INTERVAL_MS = 30_000;

/**
 * Mount once inside the reader UI. Periodically POSTs the current reading
 * position to `/api/reading/progress` (every 30s), and fires a final
 * best-effort save via `navigator.sendBeacon` on `beforeunload` so a closed
 * tab doesn't lose the last few seconds of progress.
 */
export function useReadingProgressSync() {
  useEffect(() => {
    const progressUrl = `${API_BASE_URL}/reading/progress`;

    const syncProgress = () => {
      const payload = buildProgressPayload();
      if (!payload) return;
      fetch(progressUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        // Best-effort — a dropped periodic sync isn't worth surfacing to the
        // reader; the next interval (or beforeunload) will retry.
      });
    };

    const handleBeforeUnload = () => {
      const payload = buildProgressPayload();
      if (!payload) return;
      const blob = new Blob([JSON.stringify(payload)], {
        type: "application/json",
      });
      navigator.sendBeacon?.(progressUrl, blob);
    };

    const intervalId = window.setInterval(syncProgress, PROGRESS_SYNC_INTERVAL_MS);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
}
