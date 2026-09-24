"use client";

import { findEditionById } from "@/lib/mock-books";
import { usePlayerStore } from "@/lib/stores/player-store";
import { MiniPlayer } from "@/components/layout/MiniPlayer";
import { PersistentAudioPlayer } from "@/components/layout/PersistentAudioPlayer";

/**
 * Root-level mount point for the persistent audio player.
 *
 * `PersistentAudioPlayer` (the hoisted `<audio>` element + Zustand sync) and
 * `MiniPlayer` (the bottom-docked control bar) were already built by an
 * earlier workstream, but nothing in the app actually mounted them yet —
 * this file is that mount point, added here (not inside
 * `components/layout/*`, which is read-only) so a track loaded from any
 * page (e.g. the reader's "Listen to this chapter" button) is audible and
 * controllable app-wide, and survives route navigation.
 *
 * Also resolves nice display titles from `lib/mock-books` based on the
 * store's `currentEditionId`/`currentChapterIdx` — both player components
 * otherwise fall back to the raw edition id / "Chapter N" when no title
 * props are passed.
 */
export function PlayerMount() {
  const currentEditionId = usePlayerStore((s) => s.currentEditionId);
  const currentChapterIdx = usePlayerStore((s) => s.currentChapterIdx);

  const found = currentEditionId ? findEditionById(currentEditionId) : undefined;
  const bookTitle = found?.book.title;
  const chapterTitle = found?.edition.chapters.find(
    (c) => c.idx === currentChapterIdx,
  )?.title;

  return (
    <>
      <PersistentAudioPlayer bookTitle={bookTitle} chapterTitle={chapterTitle} />
      <MiniPlayer bookTitle={bookTitle} chapterTitle={chapterTitle} />
    </>
  );
}
