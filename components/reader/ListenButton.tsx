"use client";

import { Button } from "@/components/ui";
import { usePlayerStore } from "@/lib/stores/player-store";
import type { ListeningChapter } from "@/lib/mock-books";

export interface ListenButtonProps {
  /** The audiobook edition's id (not the ebook edition currently being read). */
  editionId: string;
  chapter: ListeningChapter;
}

/**
 * Triggers the persistent audio player from the reader page. Deliberately
 * thin: the actual playback UI (play/pause, scrubber, skip) lives in
 * `MiniPlayer`/`PersistentAudioPlayer` (mounted once at the app root via
 * `components/PlayerMount.tsx`) — this button only ever calls into
 * `usePlayerStore`, never renders transport controls itself.
 *
 * Note: the store's real action is `loadTrack({ editionId, chapterIdx,
 * audioUrl, duration })` + `toggle()`, not a single `play(editionId,
 * chapterIdx)` call — see lib/stores/player-store.ts.
 */
export function ListenButton({ editionId, chapter }: ListenButtonProps) {
  const loadTrack = usePlayerStore((s) => s.loadTrack);
  const toggle = usePlayerStore((s) => s.toggle);
  const currentEditionId = usePlayerStore((s) => s.currentEditionId);
  const currentChapterIdx = usePlayerStore((s) => s.currentChapterIdx);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  const isCurrentTrack =
    currentEditionId === editionId && currentChapterIdx === chapter.idx;

  function handleClick() {
    if (isCurrentTrack) {
      toggle();
      return;
    }
    loadTrack({
      editionId,
      chapterIdx: chapter.idx,
      audioUrl: chapter.audioUrl,
      duration: chapter.durationSeconds,
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      {isCurrentTrack && isPlaying ? "Pause narration" : "Listen to this chapter"}
    </Button>
  );
}
