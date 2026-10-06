"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/cn";
import { usePlayerStore } from "@/lib/stores/player-store";

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return h > 0 ? `${h}:${m.toString().padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

const RATES = [0.75, 1, 1.25, 1.5, 2];
const iconBtn = "grid size-11 place-items-center rounded-full text-navy transition-colors hover:bg-navy/10 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-gold";

/**
 * The bar at the bottom of the listening page, like a music app: cover and chapter on the left, the
 * transport (previous, back 10 s, play / pause, forward 10 s, next) and the seek bar in the middle,
 * speed on the right. The play / pause button shows the REAL state of the audio, never a guess.
 */
export function PlayerBar({ cover, onChapters }: { cover: string; onChapters?: () => void }) {
  const { status, currentTime, duration, bufferedEnd, playbackRate, chapters, chapterIdx, error, bookTitle } = usePlayerStore();
  const { toggle, seek, skip, next, previous, setPlaybackRate } = usePlayerStore.getState();
  const [scrub, setScrub] = useState<number | null>(null);

  const playing = status === "playing";
  const busy = status === "loading" || status === "buffering";
  const shown = scrub ?? currentTime;
  const at = chapters.findIndex((c) => c.idx === chapterIdx);
  const chapterTitle = chapters[at]?.title ?? "";
  const max = Math.max(1, Math.floor(duration));
  const pct = duration > 0 ? (shown / duration) * 100 : 0;
  const buffered = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;
  const commit = () => scrub !== null && (seek(scrub), setScrub(null));

  return (
    <div className="sticky bottom-0 z-20 border-t border-black/10 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="mx-auto grid max-w-[1300px] items-center gap-x-6 gap-y-2 md:grid-cols-[minmax(0,1fr)_minmax(320px,560px)_minmax(0,1fr)]">
        {/* Left: what is playing */}
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-navy/10">
            <Image src={cover} alt="" fill sizes="48px" className="object-cover" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-black">{chapterTitle}</p>
            <p className="truncate text-xs text-black/60">{bookTitle}</p>
          </div>
        </div>

        {/* Middle: transport and seek bar */}
        <div className="min-w-0">
          <div className="flex items-center justify-center gap-1 sm:gap-3">
            <button type="button" aria-label="Previous chapter" onClick={previous} className={iconBtn}>
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden><path d="M6 6h2v12H6zM9.5 12 18 18V6z" /></svg>
            </button>
            <button type="button" aria-label="Back 10 seconds" onClick={() => skip(-10)} className={cn(iconBtn, "text-xs font-semibold")}>
              −10s
            </button>
            <button
              type="button"
              onClick={toggle}
              disabled={status === "idle" || status === "error"}
              aria-label={playing ? "Pause" : "Play"}
              aria-pressed={playing}
              className="grid size-12 place-items-center rounded-full bg-navy text-cream shadow transition-transform hover:scale-105 disabled:opacity-40"
            >
              {playing ? (
                <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" className={cn("size-6", busy && "animate-pulse")} fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button type="button" aria-label="Forward 10 seconds" onClick={() => skip(10)} className={cn(iconBtn, "text-xs font-semibold")}>
              +10s
            </button>
            <button type="button" aria-label="Next chapter" onClick={next} disabled={at < 0 || at >= chapters.length - 1} className={iconBtn}>
              <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden><path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" /></svg>
            </button>
          </div>

          <div className="mt-1 flex items-center gap-3 text-xs tabular-nums text-black/60">
            <span className="w-10 text-right">{fmt(shown)}</span>
            <div className="relative h-1.5 flex-1 rounded-full bg-black/10">
              <div className="absolute inset-y-0 left-0 rounded-full bg-black/15" style={{ width: `${buffered}%` }} aria-hidden />
              <div className="absolute inset-y-0 left-0 rounded-full bg-gold-bright" style={{ width: `${pct}%` }} aria-hidden />
              <div className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-navy shadow" style={{ left: `${pct}%` }} aria-hidden />
              <input
                type="range"
                aria-label="Seek"
                aria-valuetext={`${fmt(shown)} of ${fmt(duration)}`}
                min={0}
                max={max}
                step={1}
                value={Math.min(Math.floor(shown), max)}
                disabled={duration <= 0}
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={commit}
                onKeyUp={commit}
                onBlur={commit}
                onKeyDown={(e) => {
                  // Arrow keys jump 5 seconds (the browser default is one tiny step).
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    seek(shown + (e.key === "ArrowRight" ? 5 : -5));
                  }
                }}
                className="absolute -inset-y-3 inset-x-0 h-7 w-full cursor-pointer opacity-0"
              />
            </div>
            <span className="w-10">{fmt(duration)}</span>
          </div>
        </div>

        {/* Right: speed, chapters (small screens), status */}
        <div className="flex items-center justify-between gap-3 md:justify-end">
          <span aria-live="polite" className="min-w-0 truncate text-xs text-error md:hidden">
            {error ?? ""}
          </span>
          {onChapters && (
            <button type="button" onClick={onChapters} className="rounded-full border border-black/20 px-3 py-1.5 text-xs lg:hidden">
              Chapters
            </button>
          )}
          <label className="flex items-center gap-2 text-xs text-black/70">
            Speed
            <select value={playbackRate} onChange={(e) => setPlaybackRate(Number(e.target.value))} className="rounded-lg border-black/20 py-1 pl-2 pr-7 text-xs">
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {error && <p aria-live="polite" className="mt-1 hidden text-center text-xs text-error md:block">{error}</p>}
    </div>
  );
}
