import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Window = `${number} ${"s" | "m" | "h" | "d"}`;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the caller may try again (0 when ok). */
  retryAfter: number;
}

const WINDOW_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;
const toMs = (w: Window) => {
  const [n, unit] = w.split(" ") as [string, keyof typeof WINDOW_MS];
  return Number(n) * WINDOW_MS[unit];
};

// Local development and tests use an in-memory counter (per process). Production uses Upstash
// Redis over HTTP, which works on Vercel and on a VPS alike (env.ts requires it in production).
const memory = new Map<string, { count: number; resetAt: number }>();
let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

function getRedis() {
  if (redis === undefined) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    redis = url && token ? new Redis({ url, token }) : null;
  }
  return redis;
}

/**
 * Fixed-window limiter: at most `limit` calls per `window` for `key`.
 * Key it by what you are protecting, e.g. `otp:send:email:${email}` or `contact:ip:${ip}`.
 */
export async function rateLimit(key: string, limit: number, window: Window): Promise<RateLimitResult> {
  const client = getRedis();

  if (client) {
    const id = `${limit}/${window}`;
    let limiter = limiters.get(id);
    if (!limiter) {
      limiter = new Ratelimit({ redis: client, limiter: Ratelimit.fixedWindow(limit, window), prefix: "rl" });
      limiters.set(id, limiter);
    }
    const res = await limiter.limit(key);
    return { ok: res.success, retryAfter: res.success ? 0 : Math.max(1, Math.ceil((res.reset - Date.now()) / 1000)) };
  }

  if (process.env.NODE_ENV === "production") {
    // ponytail: env.ts already refuses to boot without Upstash in production; this is the second lock.
    throw new Error("Rate limiting is not configured (UPSTASH_REDIS_REST_URL / TOKEN)");
  }

  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + toMs(window) });
    return { ok: true, retryAfter: 0 };
  }
  entry.count += 1;
  return entry.count <= limit
    ? { ok: true, retryAfter: 0 }
    : { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
}
