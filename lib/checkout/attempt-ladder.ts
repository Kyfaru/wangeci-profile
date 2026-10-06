import { getKv, type Kv } from "@/lib/auth/kv";

/**
 * Limits how often one buyer can START a payment, so a stolen phone number or card cannot be hammered and
 * nobody can be spammed with prompts.
 *   5 attempts, then a lock. The locks grow: 5 min, 5 min, 10, 20, 40, 60 minutes.
 *   After the 60 minute lock and 5 more attempts, the buyer must wait 24 hours and is told to contact support.
 * A successful payment clears everything. Numbers live here so they can be tuned in one place.
 */
export const PAY_LADDER = {
  attemptsPerSeries: 5,
  lockMinutes: [5, 5, 10, 20, 40, 60],
  finalLockHours: 24,
  stateTtlSeconds: 3 * 24 * 3600,
} as const;

export interface PayLadderState {
  /** Attempts used in the current series. */
  attempts: number;
  /** Finished series so far. */
  series: number;
  /** Epoch ms until which no new attempt may start. 0 = free. */
  lockedUntil: number;
  /** True once the final 24 hour lock was reached: the message should point to support. */
  contactSupport: boolean;
}

export const emptyPayState = (): PayLadderState => ({ attempts: 0, series: 0, lockedUntil: 0, contactSupport: false });

/** Pure: the state after one more attempt is started. */
export function applyAttempt(state: PayLadderState, now: number): PayLadderState {
  const next = { ...state, attempts: state.attempts + 1 };
  if (next.attempts < PAY_LADDER.attemptsPerSeries) return next;

  next.attempts = 0;
  next.series += 1;
  if (next.series <= PAY_LADDER.lockMinutes.length) {
    next.lockedUntil = now + PAY_LADDER.lockMinutes[next.series - 1] * 60_000;
  } else {
    next.lockedUntil = now + PAY_LADDER.finalLockHours * 3_600_000;
    next.contactSupport = true;
  }
  return next;
}

export type AttemptDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number; contactSupport: boolean };

const keyFor = (identity: string) => `pay-ladder:${identity.trim().toLowerCase()}`;

export function createPayLadder(store?: Kv, clock: () => number = Date.now) {
  const kv = () => store ?? getKv();
  const load = async (id: string) => (await kv().get<PayLadderState>(keyFor(id))) ?? emptyPayState();
  return {
    /** Ask first (this does not count an attempt). */
    async check(identity: string): Promise<AttemptDecision> {
      const s = await load(identity);
      const now = clock();
      return s.lockedUntil > now ? { allowed: false, retryAfterSeconds: Math.ceil((s.lockedUntil - now) / 1000), contactSupport: s.contactSupport } : { allowed: true };
    },
    /** Count one started attempt. Call after check() said allowed. Returns the lock it caused, if any. */
    async record(identity: string): Promise<AttemptDecision> {
      const next = applyAttempt(await load(identity), clock());
      await kv().set(keyFor(identity), next, PAY_LADDER.stateTtlSeconds);
      const now = clock();
      return next.lockedUntil > now ? { allowed: false, retryAfterSeconds: Math.ceil((next.lockedUntil - now) / 1000), contactSupport: next.contactSupport } : { allowed: true };
    },
    async clear(identity: string): Promise<void> {
      await kv().del(keyFor(identity));
    },
  };
}

export const payLadder = createPayLadder();
