"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useReaderStore } from "@/lib/stores/reader-store";

const GAP = 48; // px between pages (columns)
const FONT_KEY = "wc_reader_font";
const FONT_MIN = 16;
const FONT_MAX = 28;

interface ChapterReaderProps {
  slug: string;
  editionId: string;
  chapterIdx: number;
  title: string;
  paragraphs: string[];
  /** Where to open: the first word of the page to show (resume point, bookmark or "end of chapter"). */
  startWord: number;
  prevIdx: number | null;
  nextIdx: number | null;
  wordsBefore: number;
  wordsInChapter: number;
  totalWords: number;
}

/**
 * The reader. A chapter is poured into CSS columns, and each column is one "page": the number of pages
 * depends on the device (a small phone gets many short pages, a tablet gets fewer long ones), because
 * the pages are measured on this screen with this font size. The position that is saved is the first
 * WORD on the page, which every device agrees on.
 */
export function ChapterReader({ slug, editionId, chapterIdx, title, paragraphs, startWord, prevIdx, nextIdx, wordsBefore, wordsInChapter, totalWords }: ChapterReaderProps) {
  const router = useRouter();
  const viewRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const setPosition = useReaderStore((s) => s.setPosition);

  const [size, setSize] = useState({ w: 0, h: 0 });
  // Rendered client-only (see ChapterReaderClient), so the saved text size can be read while initialising.
  const [fontSize, setFontSize] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(FONT_KEY));
      return saved >= FONT_MIN && saved <= FONT_MAX ? saved : 20;
    } catch {
      return 20;
    }
  });
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const pageStarts = useRef<number[]>([0]); // for event handlers
  const [starts, setStarts] = useState<number[]>([0]); // for rendering
  const pageRef = useRef(0);
  const wantedWord = useRef<number | null>(startWord); // word to land on after the next measurement
  const swipe = useRef<number | null>(null);

  // Words with their global index inside this chapter, grouped by paragraph.
  const blocks = useMemo(() => {
    let n = 0;
    return paragraphs.map((p) => p.split(/\s+/).filter(Boolean).map((text) => ({ text, i: n++ })));
  }, [paragraphs]);

  const changeFont = (delta: number) =>
    setFontSize((f) => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, f + delta));
      try {
        localStorage.setItem(FONT_KEY, String(next));
      } catch {
        /* ignore */
      }
      wantedWord.current = pageStarts.current[page] ?? 0; // stay on the same words after re-flow
      return next;
    });

  // Size of the reading area (re-measured on rotate, resize, keyboard, ...).
  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const read = () => setSize({ w: Math.floor(el.clientWidth), h: Math.floor(el.clientHeight) });
    read();
    const ro = new ResizeObserver(() => {
      wantedWord.current = pageStarts.current[pageRef.current] ?? 0;
      read();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Measure: how many pages, and which word starts each page.
  const measure = useCallback(() => {
    const flow = flowRef.current;
    if (!flow || size.w === 0 || size.h === 0) return;
    const step = size.w + GAP;
    const total = Math.max(1, Math.round((flow.scrollWidth + GAP) / step));
    const els = flow.querySelectorAll<HTMLElement>("[data-w]");
    const st: number[] = new Array(total).fill(-1);
    let lastPageSeen = -1;
    els.forEach((el, idx) => {
      const p = Math.min(total - 1, Math.floor((el.offsetLeft + 2) / step));
      if (p !== lastPageSeen) {
        for (let q = lastPageSeen + 1; q <= p; q++) if (st[q] === -1) st[q] = idx;
        lastPageSeen = p;
      }
    });
    for (let q = 0; q < total; q++) if (st[q] === -1) st[q] = Math.max(0, els.length - 1);
    pageStarts.current = st;
    setStarts(st);
    setPages(total);

    const target = wantedWord.current;
    wantedWord.current = null;
    if (target !== null) {
      let p = 0;
      for (let q = 0; q < total; q++) if (st[q] <= Math.min(target, Math.max(0, els.length - 1))) p = q;
      setPage(p);
    } else {
      setPage((p) => Math.min(p, total - 1));
    }
  }, [size.w, size.h]);

  useLayoutEffect(() => {
    measure();
  }, [measure, fontSize, blocks]);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => !cancelled && measure()).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [measure]);

  // Tell the store (and so the saver) where the reader is, and where this page ends.
  const wordStart = starts[page] ?? 0;
  const wordEnd = starts[page + 1] ?? wordsInChapter;
  useEffect(() => {
    setPosition({ editionId, chapterIdx, wordOffset: wordStart, wordEnd });
  }, [editionId, chapterIdx, wordStart, wordEnd, setPosition]);

  const base = `/dashboard/books/${slug}/read`;
  const goNext = useCallback(() => {
    if (page < pages - 1) setPage(page + 1);
    else if (nextIdx !== null) router.push(`${base}?idx=${nextIdx}`);
  }, [page, pages, nextIdx, router, base]);
  const goPrev = useCallback(() => {
    if (page > 0) setPage(page - 1);
    else if (prevIdx !== null) router.push(`${base}?idx=${prevIdx}&w=end`);
  }, [page, prevIdx, router, base]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goNext();
      if (e.key === "ArrowLeft" || e.key === "PageUp") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  // Estimated book-wide page numbers: this chapter's measured words per page, applied to the whole book.
  const wordsPerPage = Math.max(1, wordsInChapter / pages);
  const shown = Math.floor((wordsBefore + wordStart) / wordsPerPage) + 1;
  const of = Math.max(shown, Math.ceil(totalWords / wordsPerPage));
  const atStart = page === 0 && prevIdx === null;
  const atEnd = page === pages - 1 && nextIdx === null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 px-6 py-6 md:px-16 md:py-8">
        <div
          ref={viewRef}
          className="relative min-h-[320px] min-w-0 flex-1 overflow-hidden"
          onTouchStart={(e) => (swipe.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (swipe.current === null) return;
            const dx = e.changedTouches[0].clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > 50) (dx < 0 ? goNext : goPrev)();
          }}
        >
          <div
            ref={flowRef}
            aria-live="polite"
            className="relative text-black"
            style={{
              width: size.w || undefined,
              height: size.h || undefined,
              columnWidth: size.w || undefined,
              columnGap: GAP,
              columnFill: "auto",
              fontSize,
              lineHeight: 1.7,
              transform: `translateX(-${page * (size.w + GAP)}px)`,
              transition: "transform 180ms ease",
            }}
          >
            <h1 className="mb-6 font-display text-[1.7em] leading-tight">{title}</h1>
            {blocks.map((words, bi) => (
              <p key={bi} className="mb-[1em]">
                {words.map((w) => (
                  <span key={w.i} data-w={w.i}>
                    {w.text}{" "}
                  </span>
                ))}
              </p>
            ))}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-black/10 bg-cream px-6 py-4 md:px-16">
        <button type="button" onClick={goPrev} disabled={atStart} className={cn("font-display text-lg text-gold", atStart ? "opacity-30" : "hover:opacity-70")}>
          {"< Previous"}
        </button>
        <div className="flex items-center gap-4 text-center text-black">
          <div className="hidden items-center gap-1 sm:flex" role="group" aria-label="Text size">
            <button type="button" onClick={() => changeFont(-2)} aria-label="Smaller text" className="rounded px-2 text-sm hover:bg-black/5">
              A-
            </button>
            <button type="button" onClick={() => changeFont(2)} aria-label="Larger text" className="rounded px-2 text-lg hover:bg-black/5">
              A+
            </button>
          </div>
          <p className="font-display text-sm sm:text-base" aria-label={`Page ${shown} of about ${of}`}>
            Page <span className="text-gold">{shown}</span> of {of}
          </p>
        </div>
        <button type="button" onClick={goNext} disabled={atEnd} className={cn("font-display text-lg text-gold", atEnd ? "opacity-30" : "hover:opacity-70")}>
          {"Next >"}
        </button>
      </div>
    </div>
  );
}
