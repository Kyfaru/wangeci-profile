"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { PlayerBar } from "@/components/audio/PlayerBar";
import { Transcript } from "@/components/audio/Transcript";
import { cn } from "@/lib/cn";
import { usePlayerStore, type PlayerChapter } from "@/lib/stores/player-store";

interface Props {
  editionId: string;
  slug: string;
  bookTitle: string;
  author: string;
  cover: string;
  chapters: PlayerChapter[];
  /** Resume point from the saved listening position. */
  startChapterIdx: number;
  startSeconds: number;
}

const mins = (s: number | null) => (s ? `${Math.max(1, Math.round(s / 60))} min` : "");

/**
 * The listening page, laid out like the reader (Figma "The Book" frame) but for audio: the chapter text
 * large in the middle and read along as the narrator speaks, cover and chapters on the right, and a
 * music-style player bar where the reader's "Page 50 of 200" sits. The audio itself lives in AudioHost.
 */
export function ListenClient({ editionId, slug, bookTitle, author, cover, chapters, startChapterIdx, startSeconds }: Props) {
  const current = usePlayerStore((s) => (s.editionId === editionId ? s.chapterIdx : null));
  const status = usePlayerStore((s) => s.status);
  const chapterText = usePlayerStore((s) => s.chapterText);
  const [showChapters, setShowChapters] = useState(false);

  // Open the book once (paused, at the saved place). If the same book is already loaded, leave playback alone.
  useEffect(() => {
    const s = usePlayerStore.getState();
    if (s.editionId === editionId && s.src) return;
    void s.open({ editionId, slug, bookTitle, author, cover, chapters }, startChapterIdx, startSeconds);
  }, [editionId, slug, bookTitle, author, cover, chapters, startChapterIdx, startSeconds]);

  const title = chapters.find((c) => c.idx === current)?.title ?? bookTitle;

  const list = (
    <ol className="divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
      {chapters.map((c) => {
        const active = c.idx === current;
        return (
          <li key={c.idx}>
            <button
              type="button"
              onClick={() => {
                setShowChapters(false);
                void usePlayerStore.getState().playChapter(c.idx, 0, true);
              }}
              aria-current={active ? "true" : undefined}
              className={cn("flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-cream", active && "bg-cream")}
            >
              <span className={cn("text-base", active ? "font-semibold text-gold" : "text-black")}>
                {active && status === "playing" ? "▶ " : ""}
                {c.title}
              </span>
              <span className="shrink-0 text-xs text-black/50">{mins(c.durationSeconds)}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 md:px-16" data-transcript-scroll>
          {chapterText ? (
            <div className="mx-auto max-w-[900px]">
              <Transcript text={chapterText} title={title} />
            </div>
          ) : (
            <div className="mx-auto max-w-[900px] text-center">
              <div className="relative mx-auto aspect-[282/329] w-full max-w-[282px] overflow-hidden rounded-[20px]">
                <Image src={cover} alt={`${bookTitle} cover`} fill sizes="282px" priority className="object-cover" />
              </div>
              <h1 className="mt-6 font-display text-3xl text-black">{title}</h1>
              <p className="mt-2 text-black/60">{status === "loading" ? "Loading..." : "The text for this chapter is not available. You can still listen."}</p>
            </div>
          )}
        </div>

        <aside className="hidden w-[365px] shrink-0 overflow-y-auto border-l border-black/10 bg-white px-6 py-8 lg:block">
          <div className="relative mx-auto aspect-[282/329] w-full max-w-[220px] overflow-hidden rounded-[20px]">
            <Image src={cover} alt={`${bookTitle} cover`} fill sizes="220px" priority className="object-cover" />
          </div>
          <h2 className="mt-5 text-center font-display text-2xl leading-tight text-black">{bookTitle}</h2>
          <p className="mt-1 text-center font-medium text-gold/70">{author}</p>
          <h3 className="mt-8 font-display text-xl text-black">Chapters</h3>
          <div className="mt-3">{list}</div>
        </aside>
      </div>

      {showChapters && (
        <div role="dialog" aria-label="Chapters" className="fixed inset-x-0 bottom-[132px] z-30 mx-3 max-h-[50vh] overflow-y-auto rounded-2xl bg-white shadow-xl lg:hidden">
          {list}
        </div>
      )}

      <PlayerBar cover={cover} onChapters={() => setShowChapters((v) => !v)} />
    </div>
  );
}
