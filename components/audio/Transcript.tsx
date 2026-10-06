"use client";

import { useEffect, useMemo, useRef } from "react";

import { buildTiming, splitParagraphs, wordIndexAt, wordStart } from "@/lib/audio/word-timing";
import { usePlayerStore } from "@/lib/stores/player-store";

/**
 * Read-along text. Words that have been spoken (and the one being spoken now) turn black; the words
 * still to come stay faint, so you can see exactly where the narrator is. The view follows the voice,
 * like lyrics in a music app, but stops following for a few seconds when you scroll it yourself.
 * Click a word to jump the audio there. Timing is estimated (see lib/audio/word-timing.ts).
 */
export function Transcript({ text, title }: { text: string; title: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastIndex = useRef(-1);
  const userScrolledAt = useRef(0);
  const lastParagraph = useRef(-1);

  const { words, ends } = useMemo(() => buildTiming(text), [text]);
  const paragraphs = useMemo(() => {
    const out: typeof words[] = [];
    for (const w of words) (out[w.paragraph] ??= []).push(w);
    return out;
  }, [words]);
  const total = splitParagraphs(text).length;

  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const index = duration > 0 ? wordIndexAt(ends, currentTime / duration) : -1;

  // Repaint only the words that changed since last time (a chapter can have thousands of words).
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-i]");
    const prev = lastIndex.current;
    const lo = Math.min(prev < 0 || prev >= els.length ? 0 : prev, Math.max(index, 0));
    const hi = Math.max(prev < 0 || prev >= els.length ? els.length - 1 : prev, index);
    for (let k = lo; k <= hi && k < els.length; k++) {
      if (k <= index) els[k].dataset.read = "true";
      else delete els[k].dataset.read;
    }
    lastIndex.current = index;

    // Follow the voice: bring a new paragraph to the middle of the view.
    const w = words[index];
    if (w && w.paragraph !== lastParagraph.current) {
      lastParagraph.current = w.paragraph;
      if (Date.now() - userScrolledAt.current > 4000) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        els[index]?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
      }
    }
  }, [index, words]);

  // A new chapter starts from a clean slate.
  useEffect(() => {
    lastIndex.current = -1;
    lastParagraph.current = -1;
    rootRef.current?.querySelectorAll<HTMLElement>("[data-read]").forEach((el) => delete el.dataset.read);
  }, [text]);

  const onWordClick = (i: number) => {
    const d = usePlayerStore.getState().duration;
    if (d > 0) usePlayerStore.getState().seek(wordStart(ends, i) * d);
  };

  return (
    <div
      ref={rootRef}
      onWheel={() => (userScrolledAt.current = Date.now())}
      onTouchMove={() => (userScrolledAt.current = Date.now())}
      className="text-[clamp(1.5rem,2.3vw,2.25rem)] leading-[1.65]"
    >
      <h1 className="mb-8 font-display text-[1.25em] leading-tight text-black">{title}</h1>
      {paragraphs.map((ws, p) => (
        <p key={p} className="mb-[0.9em]">
          {ws.map((w) => (
            <span
              key={w.i}
              data-i={w.i}
              onClick={() => onWordClick(w.i)}
              className="cursor-pointer text-black/25 transition-colors duration-150 hover:text-black/60 data-[read=true]:text-black"
            >
              {w.text}{" "}
            </span>
          ))}
        </p>
      ))}
      {total === 0 && <p className="text-black/50">The text for this chapter is not available.</p>}
    </div>
  );
}
