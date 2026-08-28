"use client";

import { usePlayerStore } from "@/lib/stores/player-store";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui";
import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "./icons";

export interface MiniPlayerProps {
  className?: string;
  /** Display title for the current book/edition. The store only holds
   * `currentEditionId`, not display copy, so this falls back to that raw
   * id when omitted — pass a real title once the composing page/layout
   * knows how to resolve one. */
  bookTitle?: string;
  /** Display title for the current chapter. Falls back to
   * "Chapter {currentChapterIdx + 1}" derived from the store when omitted. */
  chapterTitle?: string;
}

const SKIP_SECONDS = 30;
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Bottom-docked persistent audio control bar — pure UI over `usePlayerStore`.
 * Renders nothing while no track is loaded (`audioUrl` is null/undefined).
 *
 * Deliberately has no `<audio>` element of its own: `PersistentAudioPlayer`
 * owns the single hoisted `<audio>` tag and keeps it in sync with the store
 * (including reacting to the scrubber/skip actions here, via a "did the
 * store's currentTime jump far from the audio element's actual position"
 * check — see that component for why).
 */
export function MiniPlayer({
  className,
  bookTitle,
  chapterTitle,
}: MiniPlayerProps) {
  const audioUrl = usePlayerStore((s) => s.audioUrl);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const currentEditionId = usePlayerStore((s) => s.currentEditionId);
  const currentChapterIdx = usePlayerStore((s) => s.currentChapterIdx);
  const toggle = usePlayerStore((s) => s.toggle);
  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);

  if (!audioUrl) return null;

  const resolvedBookTitle = bookTitle ?? currentEditionId ?? "Audiobook";
  const resolvedChapterTitle =
    chapterTitle ?? `Chapter ${currentChapterIdx + 1}`;

  function skip(delta: number) {
    setCurrentTime(Math.min(duration || Infinity, Math.max(0, currentTime + delta)));
  }

  function cyclePlaybackRate() {
    const idx = PLAYBACK_RATES.indexOf(
      playbackRate as (typeof PLAYBACK_RATES)[number],
    );
    const next = PLAYBACK_RATES[(idx + 1 + PLAYBACK_RATES.length) % PLAYBACK_RATES.length];
    setPlaybackRate(next ?? 1);
  }

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-gold/20 bg-navy text-cream",
        className,
      )}
    >
      <div className="mx-auto flex max-w-[1440px] flex-col gap-2 px-4 py-3 lg:px-8">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {resolvedChapterTitle}
            </p>
            <p className="truncate text-xs text-cream/60">
              {resolvedBookTitle}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              aria-label={`Back ${SKIP_SECONDS} seconds`}
              icon={<SkipBackIcon />}
              variant="ghost"
              size="sm"
              // `!`-suffixed (Tailwind v4 important syntax) since `cn()` is a
              // plain class-string joiner with no conflict resolution — the
              // base "ghost" variant's `text-navy` needs to lose deterministically
              // against this dark navy bar, not just by class order luck.
              className="text-cream! hover:bg-cream/10!"
              onClick={() => skip(-SKIP_SECONDS)}
            />
            <IconButton
              aria-label={isPlaying ? "Pause" : "Play"}
              icon={isPlaying ? <PauseIcon /> : <PlayIcon />}
              variant="solid"
              size="md"
              className="bg-gold-bright! text-navy! hover:bg-gold-bright/90!"
              onClick={toggle}
            />
            <IconButton
              aria-label={`Forward ${SKIP_SECONDS} seconds`}
              icon={<SkipForwardIcon />}
              variant="ghost"
              size="sm"
              className="text-cream! hover:bg-cream/10!"
              onClick={() => skip(SKIP_SECONDS)}
            />
          </div>

          <button
            type="button"
            onClick={cyclePlaybackRate}
            aria-label={`Playback speed, currently ${playbackRate}x. Tap to change.`}
            className="hidden shrink-0 rounded-full border border-cream/20 px-3 py-1.5 text-xs font-semibold tabular-nums hover:border-gold-bright hover:text-gold-bright sm:inline-flex"
          >
            {playbackRate}x
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-10 shrink-0 text-right text-[11px] tabular-nums text-cream/60">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            aria-label="Seek"
            className="h-1.5 w-full flex-1 cursor-pointer appearance-none rounded-full bg-cream/20 accent-gold-bright"
          />
          <span className="w-10 shrink-0 text-[11px] tabular-nums text-cream/60">
            {formatTime(duration)}
          </span>
        </div>
      </div>
    </div>
  );
}
