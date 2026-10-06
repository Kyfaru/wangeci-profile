import { describe, expect, it } from "vitest";

import { buildTiming, splitParagraphs, wordIndexAt, wordStart } from "./word-timing";

describe("read-along timing", () => {
  const text = "Hello there, dear reader.\n\nThis is the second paragraph.";
  const { words, ends } = buildTiming(text);

  it("splits paragraphs and words", () => {
    expect(splitParagraphs(text)).toHaveLength(2);
    expect(words.map((w) => w.text).slice(0, 3)).toEqual(["Hello", "there,", "dear"]);
    expect(words.at(-1)?.paragraph).toBe(1);
    expect(words.every((w, k) => w.i === k)).toBe(true);
  });

  it("ends at exactly 1 and never goes backwards", () => {
    expect(ends.at(-1)).toBeCloseTo(1, 10);
    for (let k = 1; k < ends.length; k++) expect(ends[k]).toBeGreaterThan(ends[k - 1]);
  });

  it("finds the word being spoken", () => {
    expect(wordIndexAt(ends, 0)).toBe(0);
    expect(wordIndexAt(ends, 1)).toBe(ends.length - 1);
    expect(wordIndexAt(ends, 0.5)).toBeGreaterThan(0);
    expect(wordIndexAt(ends, 0.5)).toBeLessThan(ends.length - 1);
    expect(wordIndexAt([], 0.5)).toBe(-1);
  });

  it("gives longer words and punctuation more time", () => {
    const t = buildTiming("a extraordinarily b.");
    const share = (i: number) => t.ends[i] - (t.ends[i - 1] ?? 0);
    expect(share(1)).toBeGreaterThan(share(0));
    expect(share(2)).toBeGreaterThan(share(0)); // full stop adds a pause
  });

  it("maps a word back to its start time", () => {
    expect(wordStart(ends, 0)).toBe(0);
    expect(wordStart(ends, 3)).toBe(ends[2]);
    expect(wordIndexAt(ends, wordStart(ends, 4) + 1e-9)).toBe(4);
  });
});
