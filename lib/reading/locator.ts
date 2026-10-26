/**
 * Reading position is stored in a way that does not depend on the device: "chapterIdx:wordOffset"
 * (for example "3:1250" = chapter 3, the 1250th word). A phone and a tablet show different page
 * counts, but they agree on the word. Audio uses "chapterIdx:seconds".
 */
export const encodeLocator = (chapterIdx: number, offset: number) => `${chapterIdx}:${Math.max(0, Math.floor(offset))}`;

export function parseLocator(locator: string): { chapterIdx: number; offset: number } | null {
  const m = /^(\d{1,4}):(\d{1,9})$/.exec(locator);
  return m ? { chapterIdx: Number(m[1]), offset: Number(m[2]) } : null;
}

/** Share of the whole book that lies before this position, 0 to 100. Words read / total words. */
export function progressPercent(chapters: { idx: number; wordCount: number }[], chapterIdx: number, wordOffset: number): number {
  const total = chapters.reduce((n, c) => n + c.wordCount, 0);
  if (total === 0) return 0;
  const before = chapters.filter((c) => c.idx < chapterIdx).reduce((n, c) => n + c.wordCount, 0);
  const here = chapters.find((c) => c.idx === chapterIdx)?.wordCount ?? 0;
  const read = before + Math.min(Math.max(0, wordOffset), here);
  return Math.min(100, Math.round((read / total) * 1000) / 10);
}

/** Audio: share of total listening time before this position. */
export function audioProgressPercent(chapters: { idx: number; durationSeconds: number | null }[], chapterIdx: number, seconds: number): number {
  const total = chapters.reduce((n, c) => n + (c.durationSeconds ?? 0), 0);
  if (total === 0) return 0;
  const before = chapters.filter((c) => c.idx < chapterIdx).reduce((n, c) => n + (c.durationSeconds ?? 0), 0);
  const here = chapters.find((c) => c.idx === chapterIdx)?.durationSeconds ?? 0;
  return Math.min(100, Math.round(((before + Math.min(Math.max(0, seconds), here)) / total) * 1000) / 10);
}


/**
 * Which chapter (index into `chapters`) and word the reader opens at. An explicit `?idx=` link wins, then
 * the saved position. If the wanted chapter no longer exists (the book was edited), start at the top of
 * chapter 0: an old word offset means nothing in a different chapter.
 */
export function resolveStart(
  sp: { idx?: string | string[]; w?: string | string[] },
  resume: { chapterIdx: number; offset: number } | null,
  chapters: { idx: number; wordCount: number }[],
): { position: number; startWord: number } {
  const explicit = typeof sp.idx === "string";
  const wantedIdx = explicit ? Number(sp.idx) : resume?.chapterIdx;
  const position = chapters.findIndex((c) => c.idx === wantedIdx);
  if (position < 0) return { position: 0, startWord: 0 };
  if (!explicit) return { position, startWord: resume?.offset ?? 0 };
  const w = typeof sp.w === "string" ? sp.w : "";
  return { position, startWord: w === "end" ? Math.max(0, chapters[position].wordCount - 1) : Math.max(0, Number(w) || 0) };
}