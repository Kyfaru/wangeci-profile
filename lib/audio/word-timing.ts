/**
 * Estimated timing for "read-along" text. We do not have a recording-aligned timing file, so the time
 * of each word is estimated by sharing the chapter's duration out in proportion to word length, with
 * extra weight after punctuation (a narrator pauses at commas, full stops and paragraph ends).
 * It tracks the narration closely enough to follow along; exact timings (from an alignment tool or
 * the narrator) can replace this later without changing the player.
 */
export interface TimedWord {
  text: string;
  /** Global word index within the chapter. */
  i: number;
  /** Index of the paragraph this word is in. */
  paragraph: number;
}

const weightOf = (word: string, endsParagraph: boolean) => {
  const base = Math.max(2, word.replace(/[^\p{L}\p{N}]/gu, "").length);
  const last = word.at(-1) ?? "";
  const pause = /[.!?…]/.test(last) ? 6 : /[,;:—–-]/.test(last) ? 3 : 0;
  return base + pause + (endsParagraph ? 6 : 0);
};

export function splitParagraphs(text: string): string[] {
  return text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
}

/** The words of a text, and for each word the FRACTION (0 to 1) of the chapter at which it has been spoken. */
export function buildTiming(text: string): { words: TimedWord[]; ends: number[] } {
  const words: TimedWord[] = [];
  const weights: number[] = [];
  splitParagraphs(text).forEach((para, p, all) => {
    const tokens = para.split(/\s+/).filter(Boolean);
    tokens.forEach((token, k) => {
      words.push({ text: token, i: words.length, paragraph: p });
      weights.push(weightOf(token, k === tokens.length - 1 && p < all.length - 1));
    });
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let run = 0;
  const ends = weights.map((w) => (run += w) / total);
  return { words, ends };
}

/** Index of the word being spoken at `fraction` of the chapter (the first word whose end is still ahead). -1 before any text. */
export function wordIndexAt(ends: number[], fraction: number): number {
  if (ends.length === 0) return -1;
  if (fraction <= 0) return 0;
  let lo = 0;
  let hi = ends.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (ends[mid] > fraction) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

/** Where (as a fraction of the chapter) a word starts, used to seek when a word is clicked. */
export const wordStart = (ends: number[], i: number) => (i <= 0 ? 0 : (ends[i - 1] ?? 0));
