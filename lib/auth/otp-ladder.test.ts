import { describe, expect, it } from "vitest";
import { memoryKv } from "./kv";
import { applyFailure, createLadder, emptyState, LADDER, retryAfterSeconds } from "./otp-ladder";

const fail = (n: number, state = emptyState(), now = 0) => {
  for (let i = 0; i < n; i++) state = applyFailure(state, now);
  return state;
};

describe("otp ladder state machine", () => {
  it("does not lock before 5 wrong guesses", () => {
    expect(fail(4).lockedUntil).toBe(0);
  });

  it("locks 5 minutes after the 5th wrong guess", () => {
    const s = fail(5, emptyState(), 1000);
    expect(s.lockedUntil).toBe(1000 + LADDER.shortCooldownMs);
    expect(s.series).toBe(1);
  });

  it("uses a 2 hour cooldown after the 25th wrong guess (end of round 1 and 2)", () => {
    const s = fail(25, emptyState(), 0);
    expect(s.lockedUntil).toBe(LADDER.longCooldownMs);
    expect(s.round).toBe(1);
    const second = fail(25, s, 0);
    expect(second.lockedUntil).toBe(LADDER.longCooldownMs);
    expect(second.round).toBe(2);
  });

  it("ends round 3 with a 5 hour lock, then starts over", () => {
    const s = fail(75, emptyState(), 0);
    expect(s.lockedUntil).toBe(LADDER.finalLockMs);
    expect(s.round).toBe(0);
    expect(s.series).toBe(0);
  });

  it("reports seconds left on a lock", () => {
    const s = fail(5, emptyState(), 0);
    expect(retryAfterSeconds(s, 0)).toBe(300);
    expect(retryAfterSeconds(s, 300_000)).toBe(0);
  });
});

describe("otp ladder with a store", () => {
  it("locks, then clears on success", async () => {
    let now = 0;
    const ladder = createLadder(memoryKv(), () => now);
    for (let i = 0; i < 4; i++) expect(await ladder.recordFailure("A@x.com")).toBe(0);
    expect(await ladder.recordFailure("a@x.com")).toBe(300); // identifier is case-insensitive
    expect(await ladder.retryAfter("a@x.com")).toBe(300);
    now = 301_000;
    expect(await ladder.retryAfter("a@x.com")).toBe(0);
    await ladder.clear("a@x.com");
    expect(await ladder.retryAfter("a@x.com")).toBe(0);
  });
});
