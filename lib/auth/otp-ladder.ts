import { getKv, type Kv } from "@/lib/auth/kv";

/**
 * Staged lockout for wrong sign-in codes, per identifier (email or phone):
 *   5 wrong guesses = one series, then a 5 minute cooldown.
 *   5 series (25 guesses) = a round. Rounds 1 and 2 end with a 2 hour cooldown.
 *   Round 3 uses 5 minute cooldowns again and ends with a 5 hour lock, after which it starts over.
 * A correct code clears everything. Numbers are constants so they can be tuned in one place.
 */
export const LADDER = {
  attemptsPerSeries: 5,
  seriesPerRound: 5,
  shortCooldownMs: 5 * 60_000,
  longCooldownMs: 2 * 3_600_000,
  finalLockMs: 5 * 3_600_000,
  longRounds: 2,
  /** State is forgotten this long after the last failure. */
  stateTtlSeconds: 48 * 3600,
} as const;

export interface LadderState {
  /** Wrong guesses in the current series. */
  fails: number;
  /** Finished series in the current round. */
  series: number;
  /** Finished rounds (0, 1, 2). */
  round: number;
  /** Epoch ms until which no codes may be sent or checked. 0 = not locked. */
  lockedUntil: number;
}

export const emptyState = (): LadderState => ({ fails: 0, series: 0, round: 0, lockedUntil: 0 });

/** Pure: the state after one more wrong guess. */
export function applyFailure(state: LadderState, now: number): LadderState {
  const next = { ...state, fails: state.fails + 1 };
  if (next.fails < LADDER.attemptsPerSeries) return next;

  next.fails = 0;
  next.series += 1;
  if (next.series < LADDER.seriesPerRound) {
    next.lockedUntil = now + LADDER.shortCooldownMs;
    return next;
  }

  next.series = 0;
  if (next.round < LADDER.longRounds) {
    next.round += 1;
    next.lockedUntil = now + LADDER.longCooldownMs;
  } else {
    next.round = 0;
    next.lockedUntil = now + LADDER.finalLockMs;
  }
  return next;
}

/** Seconds left on a lock, 0 when free. */
export const retryAfterSeconds = (state: LadderState, now: number) =>
  state.lockedUntil > now ? Math.ceil((state.lockedUntil - now) / 1000) : 0;

const keyFor = (identifier: string) => `otp-ladder:${identifier.trim().toLowerCase()}`;

// The store is looked up on first use (not at import) so `next build`, which has no Redis, can load this file.
export function createLadder(store?: Kv, clock: () => number = Date.now) {
  const kv = {
    get: <T>(key: string) => (store ?? getKv()).get<T>(key),
    set: (key: string, value: unknown, ttl: number) => (store ?? getKv()).set(key, value, ttl),
    del: (key: string) => (store ?? getKv()).del(key),
  };
  const load = async (id: string) => (await kv.get<LadderState>(keyFor(id))) ?? emptyState();
  return {
    /** Seconds the caller must wait before a code can be sent or checked (0 = go ahead). */
    async retryAfter(id: string): Promise<number> {
      return retryAfterSeconds(await load(id), clock());
    },
    /** Record a wrong guess. Returns the seconds of lock this caused (0 if none yet). */
    async recordFailure(id: string): Promise<number> {
      const next = applyFailure(await load(id), clock());
      await kv.set(keyFor(id), next, LADDER.stateTtlSeconds);
      return retryAfterSeconds(next, clock());
    },
    /** A correct code clears the whole ladder. */
    async clear(id: string): Promise<void> {
      await kv.del(keyFor(id));
    },
  };
}
