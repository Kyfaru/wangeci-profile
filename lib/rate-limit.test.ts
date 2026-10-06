import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit (in-memory fallback)", () => {
  it("allows up to the limit, then blocks with a retryAfter", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) expect((await rateLimit(key, 3, "1 m")).ok).toBe(true);
    const blocked = await rateLimit(key, 3, "1 m");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("keeps separate counters per key", async () => {
    const a = `a:${Math.random()}`;
    await rateLimit(a, 1, "1 m");
    expect((await rateLimit(a, 1, "1 m")).ok).toBe(false);
    expect((await rateLimit(`b:${Math.random()}`, 1, "1 m")).ok).toBe(true);
  });
});
