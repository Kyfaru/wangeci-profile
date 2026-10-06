"use client";

import { useState } from "react";

import { MaskIcon } from "@/components/ui/MaskIcon";
import { cn } from "@/lib/cn";
import { useReaderStore } from "@/lib/stores/reader-store";

interface Mark {
  id: string;
  position: number;
}

/**
 * Bookmark toggle for the page being read. A bookmark counts as "on this page" when its word falls
 * between the first and last word of the page, so it still shows after the text is re-flowed on another device.
 */
export function ReaderActions({ editionId, chapterIdx, bookmarks }: { editionId: string; chapterIdx: number; bookmarks: Mark[] }) {
  const { wordOffset, wordEnd } = useReaderStore();
  const [marks, setMarks] = useState<Mark[]>(bookmarks);
  const [pending, setPending] = useState(false);
  const here = marks.find((m) => m.position >= wordOffset && m.position < Math.max(wordEnd, wordOffset + 1));

  async function toggle() {
    if (pending) return;
    setPending(true);
    try {
      if (here) {
        const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(here.id)}`, { method: "DELETE" });
        if (res.ok) setMarks((m) => m.filter((x) => x.id !== here.id));
      } else {
        const res = await fetch("/api/bookmarks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editionId, chapterIdx, position: wordOffset }) });
        if (res.ok) {
          const { bookmark } = (await res.json()) as { bookmark: Mark };
          setMarks((m) => [...m, { id: bookmark.id, position: bookmark.position }]);
        }
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-4 text-black">
      <button type="button" onClick={toggle} aria-label={here ? "Remove bookmark" : "Add bookmark"} aria-pressed={Boolean(here)} className={cn("transition-opacity hover:opacity-70", here && "text-gold")}>
        <MaskIcon name="basil--bookmark-outline" size={22} />
      </button>
    </div>
  );
}
