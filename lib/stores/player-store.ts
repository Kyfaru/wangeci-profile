"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface PlayerChapter {
  idx: number;
  title: string;
  durationSeconds: number | null;
}

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "buffering" | "ended" | "error";

interface PlayerState {
  editionId: string | null;
  slug: string | null;
  bookTitle: string;
  author: string;
  cover: string | null;
  chapters: PlayerChapter[];
  chapterIdx: number;
  src: string | null;
  /** Text of the chapter being played, for read-along. */
  chapterText: string | null;
  /** When the current signed URL stops working (epoch ms) and how long it lived (ms). */
  expiresAt: number;
  ttlMs: number;
  /** Mirrors the real <audio> element, so the buttons never show a state the audio is not in. */
  status: PlayerStatus;
  currentTime: number;
  duration: number;
  bufferedEnd: number;
  playbackRate: number;
  error: string | null;
}

interface PlayerActions {
  /** Start a book: remembers the chapter list and loads the chapter at `startSeconds`. */
  open: (book: { editionId: string; slug: string; bookTitle: string; author: string; cover: string; chapters: PlayerChapter[] }, chapterIdx: number, startSeconds?: number) => Promise<void>;
  playChapter: (chapterIdx: number, startSeconds?: number, autoplay?: boolean) => Promise<void>;
  toggle: () => void;
  seek: (seconds: number) => void;
  skip: (deltaSeconds: number) => void;
  next: () => void;
  previous: () => void;
  setPlaybackRate: (rate: number) => void;
  /** Called by AudioHost with a fresh signed URL while playing: keeps the position and play state. */
  swapSource: (url: string, expiresInSeconds: number) => void;
  patch: (partial: Partial<PlayerState>) => void;
}

// The single <audio> element lives in AudioHost; it registers itself here so the actions can drive it.
let audioEl: HTMLAudioElement | null = null;
let pendingStart: { seconds: number; autoplay: boolean } | null = null;
export const registerAudioElement = (el: HTMLAudioElement | null) => {
  audioEl = el;
};
export const consumePendingStart = () => {
  const p = pendingStart;
  pendingStart = null;
  return p;
};

export const usePlayerStore = create<PlayerState & PlayerActions>()(
  persist(
    (set, get) => ({
      editionId: null,
      slug: null,
      bookTitle: "",
      author: "",
      cover: null,
      chapters: [],
      chapterIdx: 0,
      src: null,
      chapterText: null,
      expiresAt: 0,
      ttlMs: 0,
      status: "idle",
      currentTime: 0,
      duration: 0,
      bufferedEnd: 0,
      playbackRate: 1,
      error: null,

      async open(book, chapterIdx, startSeconds = 0) {
        set({ ...book, error: null });
        await get().playChapter(chapterIdx, startSeconds, false);
      },

      async playChapter(chapterIdx, startSeconds = 0, autoplay = true) {
        const { editionId } = get();
        if (!editionId) return;
        set({ status: "loading", error: null, chapterIdx, currentTime: startSeconds, bufferedEnd: 0, chapterText: null });
        try {
          // The server re-checks the purchase every time it hands out a link.
          const res = await fetch(`/api/media/chapter?editionId=${encodeURIComponent(editionId)}&idx=${chapterIdx}`, { cache: "no-store" });
          if (!res.ok) throw new Error(res.status === 404 ? "This chapter is not available." : "Could not load the audio.");
          const grant = (await res.json()) as { url: string; expiresInSeconds: number; durationSeconds: number | null; text: string | null };
          pendingStart = { seconds: startSeconds, autoplay };
          set({ chapterText: grant.text, src: grant.url, expiresAt: Date.now() + grant.expiresInSeconds * 1000, ttlMs: grant.expiresInSeconds * 1000, duration: grant.durationSeconds ?? 0 });
        } catch (error) {
          set({ status: "error", error: error instanceof Error ? error.message : "Could not load the audio." });
        }
      },

      toggle() {
        if (!audioEl || !get().src) return;
        if (audioEl.paused || audioEl.ended) void audioEl.play().catch(() => set({ status: "paused" }));
        else audioEl.pause();
      },

      seek(seconds) {
        if (!audioEl) return;
        const max = Number.isFinite(audioEl.duration) ? audioEl.duration : (get().duration || seconds);
        audioEl.currentTime = Math.min(Math.max(0, seconds), max);
        set({ currentTime: audioEl.currentTime });
      },

      skip(delta) {
        if (audioEl) get().seek(audioEl.currentTime + delta);
      },

      next() {
        const { chapters, chapterIdx } = get();
        const at = chapters.findIndex((c) => c.idx === chapterIdx);
        if (at >= 0 && at < chapters.length - 1) void get().playChapter(chapters[at + 1].idx, 0, true);
      },

      previous() {
        const { chapters, chapterIdx } = get();
        // Like a music app: more than 3 seconds in = restart this chapter; otherwise go back one.
        if (audioEl && audioEl.currentTime > 3) return get().seek(0);
        const at = chapters.findIndex((c) => c.idx === chapterIdx);
        if (at > 0) void get().playChapter(chapters[at - 1].idx, 0, true);
        else get().seek(0);
      },

      setPlaybackRate(rate) {
        if (audioEl) audioEl.playbackRate = rate;
        set({ playbackRate: rate });
      },

      swapSource(url, expiresInSeconds) {
        if (audioEl) pendingStart = { seconds: audioEl.currentTime, autoplay: !audioEl.paused };
        set({ src: url, expiresAt: Date.now() + expiresInSeconds * 1000, ttlMs: expiresInSeconds * 1000 });
      },

      patch: (partial) => set(partial),
    }),
    {
      name: "wangeci-player",
      partialize: (state) => ({ playbackRate: state.playbackRate }), // only the speed survives a reload
    },
  ),
);
