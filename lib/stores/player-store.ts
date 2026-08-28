"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PlayerState {
  isPlaying: boolean;
  currentEditionId: string | null;
  currentChapterIdx: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  audioUrl: string | null;

  /** Load a new track and start playing it from 0. */
  loadTrack: (track: {
    editionId: string;
    chapterIdx: number;
    audioUrl: string;
    duration?: number;
  }) => void;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
}

/**
 * Backs a single `<audio>` element hoisted in the root layout by a later
 * workstream (see AGENTS brief) — this file only builds the store, not the
 * player UI or the `<audio>` element itself.
 *
 * Persistence judgment call: only `playbackRate` (a per-listener UX
 * preference) survives a reload via localStorage. `isPlaying`/`currentTime`/
 * `audioUrl` are intentionally NOT persisted — rehydrating `isPlaying: true`
 * on load would attempt autoplay, which browsers block anyway, and a stale
 * `currentTime` for a track that may no longer be "current" is more
 * confusing than starting fresh.
 */
export const usePlayerStore = create<PlayerState>()(
  persist(
    (set) => ({
      isPlaying: false,
      currentEditionId: null,
      currentChapterIdx: 0,
      currentTime: 0,
      duration: 0,
      playbackRate: 1,
      audioUrl: null,

      loadTrack: ({ editionId, chapterIdx, audioUrl, duration = 0 }) =>
        set({
          currentEditionId: editionId,
          currentChapterIdx: chapterIdx,
          audioUrl,
          duration,
          currentTime: 0,
          isPlaying: true,
        }),

      play: () => set({ isPlaying: true }),
      pause: () => set({ isPlaying: false }),
      toggle: () => set((state) => ({ isPlaying: !state.isPlaying })),
      setCurrentTime: (time) => set({ currentTime: time }),
      setDuration: (duration) => set({ duration }),
      setPlaybackRate: (rate) => set({ playbackRate: rate }),
    }),
    {
      name: "wangeci-player",
      partialize: (state) => ({ playbackRate: state.playbackRate }),
    }
  )
);
