"use client";

import { useEffect } from "react";
import { create } from "zustand";

import { API_BASE_URL } from "@/lib/api/client";

export interface ReaderPosition {
  editionId: string | null;
  chapterIdx: number;
  /** The first word on the page being read (device independent: a phone and a tablet agree on it). */
  wordOffset: number;
  /** One past the last word on that page (so a bookmark can be matched to "this page"). */
  wordEnd: number;
}

interface ReaderState extends ReaderPosition {
  /** True when the position changed since the last successful save. */
  dirty: boolean;
  setPosition: (position: Partial<ReaderPosition>) => void;
  markSaved: () => void;
  reset: () => void;
}

const INITIAL_POSITION: ReaderPosition = { editionId: null, chapterIdx: 0, wordOffset: 0, wordEnd: 0 };

/**
 * In-memory only. The saved row in reading_position is the source of truth for resuming; this store
 * holds the live position while the reader is open and tells the sync hook when there is something new.
 */
export const useReaderStore = create<ReaderState>()((set) => ({
  ...INITIAL_POSITION,
  dirty: false,
  setPosition: (position) => set({ ...position, dirty: true }),
  markSaved: () => set({ dirty: false }),
  reset: () => set({ ...INITIAL_POSITION, dirty: false }),
}));

const SYNC_INTERVAL_MS = 30_000;

function payload() {
  const { editionId, chapterIdx, wordOffset } = useReaderStore.getState();
  return editionId ? { editionId, chapterIdx, offset: wordOffset } : null;
}

/**
 * Mount once inside the reader. Saves the position every 30 seconds (only if it changed), when the tab
 * is hidden, and as a last best-effort beacon when the page is closed.
 */
export function useReadingProgressSync() {
  useEffect(() => {
    const url = `${API_BASE_URL}/reading/progress`;

    const save = () => {
      const body = payload();
      if (!body || !useReaderStore.getState().dirty) return;
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true })
        .then((res) => res.ok && useReaderStore.getState().markSaved())
        .catch(() => {
          /* a dropped save is retried on the next tick */
        });
    };

    const beacon = () => {
      const body = payload();
      if (!body || !useReaderStore.getState().dirty) return;
      // text/plain keeps the beacon a "simple" request (no CORS preflight); the server parses the text.
      navigator.sendBeacon?.(url, new Blob([JSON.stringify(body)], { type: "text/plain" }));
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") beacon();
    };

    const id = window.setInterval(save, SYNC_INTERVAL_MS);
    window.addEventListener("pagehide", beacon);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", beacon);
      document.removeEventListener("visibilitychange", onVisibility);
      save(); // leaving the reader (navigating inside the app): save now
    };
  }, []);
}
