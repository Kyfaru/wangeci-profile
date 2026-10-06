import { describe, expect, it } from "vitest";

import { memoryKv } from "@/lib/auth/kv";
import { applyAttempt, createPayLadder, emptyPayState, PAY_LADDER } from "./attempt-ladder";

const MIN = 60_000;

describe("payment attempt ladder (pure)", () => {
  it("allows 5 attempts then locks for 5 minutes", () => {
    let s = emptyPayState();
    for (let i = 0; i < 4; i++) s = applyAttempt(s, 0);
    expect(s.lockedUntil).toBe(0);
    s = applyAttempt(s, 0);
    expect(s.lockedUntil).toBe(5 * MIN);
  });

  it("the locks follow 5, 5, 10, 20, 40, 60 minutes, then 24 hours with a support message", () => {
    let s = emptyPayState();
    const seen: number[] = [];
    for (let series = 0; series < 7; series++) {
      for (let i = 0; i < 5; i++) s = applyAttempt(s, 0);
      seen.push(s.lockedUntil / MIN);
    }
    expect(seen).toEqual([5, 5, 10, 20, 40, 60, 24 * 60]);
    expect(s.contactSupport).toBe(true);
  });

  it("the support message appears only at the very end", () => {
    let s = emptyPayState();
    for (let i = 0; i < 5 * 6; i++) s = applyAttempt(s, 0);
    expect(s.contactSupport).toBe(false);
  });
});

describe("payment attempt ladder (stored)", () => {
  it("blocks the 6th attempt until the lock ends, per buyer, and success clears it", async () => {
    let now = 0;
    const ladder = createPayLadder(memoryKv(), () => now);
    for (let i = 0; i < PAY_LADDER.attemptsPerSeries; i++) {
      expect(await ladder.check("A@x.com")).toEqual({ allowed: true });
      await ladder.record("a@x.com"); // identity is case-insensitive
    }
    const blocked = await ladder.check("a@x.com");
    expect(blocked).toEqual({ allowed: false, retryAfterSeconds: 300, contactSupport: false });
    expect(await ladder.check("other@x.com")).toEqual({ allowed: true });

    now = 5 * MIN + 1;
    expect(await ladder.check("a@x.com")).toEqual({ allowed: true });

    for (let i = 0; i < 5; i++) await ladder.record("a@x.com");
    expect((await ladder.check("a@x.com")).allowed).toBe(false);
    await ladder.clear("a@x.com");
    expect(await ladder.check("a@x.com")).toEqual({ allowed: true });
  });
});
