import { describe, expect, it } from "vitest";

import { audioProgressPercent, encodeLocator, parseLocator, progressPercent } from "./locator";

const chapters = [
  { idx: 0, wordCount: 1000, durationSeconds: 600 },
  { idx: 1, wordCount: 3000, durationSeconds: 1800 },
];

describe("locator", () => {
  it("round-trips and rejects junk", () => {
    expect(parseLocator(encodeLocator(3, 1250))).toEqual({ chapterIdx: 3, offset: 1250 });
    expect(encodeLocator(1, -5.9)).toBe("1:0");
    for (const bad of ["", "3", "3:", "a:b", "3:-1", "3:1:2", "99999:1"]) expect(parseLocator(bad)).toBeNull();
  });
});

describe("progress percentages", () => {
  it("counts words read over total words", () => {
    expect(progressPercent(chapters, 0, 0)).toBe(0);
    expect(progressPercent(chapters, 0, 500)).toBe(12.5);
    expect(progressPercent(chapters, 1, 1500)).toBe(62.5);
    expect(progressPercent(chapters, 1, 3000)).toBe(100);
  });

  it("clamps an offset beyond the chapter and handles an empty book", () => {
    expect(progressPercent(chapters, 1, 99999)).toBe(100);
    expect(progressPercent([], 0, 10)).toBe(0);
  });

  it("measures audio by time", () => {
    expect(audioProgressPercent(chapters, 1, 600)).toBe(50);
    expect(audioProgressPercent(chapters, 0, 0)).toBe(0);
  });
});
