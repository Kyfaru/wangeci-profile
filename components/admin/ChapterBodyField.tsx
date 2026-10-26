"use client";

import { useEffect, useState } from "react";

import { countWords, splitParagraphs } from "@/lib/reading/text";

/**
 * Controlled textarea for a chapter body. React 19 clears uncontrolled fields after a form action, so the
 * text lives in state. A copy is kept in localStorage (keyed by edition + chapter) so a dropped connection
 * or a closed tab does not lose a long chapter. A saved draft is only restored when it was made from the
 * same saved text, so an old draft never overwrites a newer save.
 */
export function ChapterBodyField({ editionId, chapterId, initial, owners }: { editionId: string; chapterId: string; initial: string; owners: number }) {
  const [value, setValue] = useState(initial);
  const [restored, setRestored] = useState(false);
  const storageKey = `chapter-draft:${editionId}:${chapterId || "new"}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as { base: string; text: string };
      if (draft.base === initial && draft.text !== initial) {
        setValue(draft.text); // eslint-disable-line react-hooks/set-state-in-effect -- restoring a draft on mount
        setRestored(true);
      }
    } catch {
      /* storage blocked or corrupt: just start from the saved text */
    }
  }, [storageKey, initial]);

  function change(text: string) {
    setValue(text);
    try {
      if (text === initial) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify({ base: initial, text }));
    } catch {
      /* ignore: the backup is a convenience */
    }
  }

  return (
    <div>
      <label className="block text-sm text-black/70" htmlFor="chapter-body">Chapter text (blank line between paragraphs)</label>
      <textarea
        id="chapter-body"
        name="body"
        required
        rows={24}
        value={value}
        onChange={(e) => change(e.target.value)}
        className="mt-1 w-full rounded-xl border-black/20 font-mono text-sm leading-relaxed"
      />
      <p className="mt-1 text-sm text-black/60" aria-live="polite">
        {countWords(value)} words, {splitParagraphs(value).length} paragraphs
        {restored ? " · restored from your unsaved draft on this device" : ""}
      </p>
      {owners > 0 && <p className="mt-1 text-sm text-amber-700">{owners} reader{owners === 1 ? "" : "s"} may land a few words off after an edit.</p>}
    </div>
  );
}
