import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { isRelaxed } from "@/lib/site";
import { AppError } from "@/lib/trace";

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

  if (!isRelaxed()) {
    // ponytail: env.ts already refuses to boot without Upstash unless staging is declared; this is the second lock.
    // Staging falls back to per-process memory below (weak on serverless, fine for testing).
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

/**
 * Like rateLimit, but throws AppError(429) when over the limit, so a route handler can just `await limit(...)`
 * and `api()` answers with the message and a Retry-After header.
 */
export async function limit(key: string, n: number, window: Window, message = "Too many requests. Please try again later."): Promise<void> {
  const result = await rateLimit(key, n, window);
  if (!result.ok) throw new AppError("RATE_LIMITED", message, 429, { retryAfter: result.retryAfter, key });
}

/**
 * The caller's address for per-IP limits. `x-forwarded-for` is only trustworthy from the right: each trusted
 * proxy appends the address it saw, so a client-supplied fake sits on the LEFT. TRUSTED_PROXY_HOPS is how many
 * proxies sit in front of the app and append (Vercel: 1 and it overwrites; Coolify/Traefik: 1; behind
 * Cloudflare + Traefik: 2). Missing or unparseable -> "unknown" (one shared bucket, never a bypass).
 */
export function clientIp(headers: Headers): string {
  const parts = (headers.get("x-forwarded-for") ?? "").split(",").map((p) => p.trim()).filter(Boolean);
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  return parts[parts.length - hops] ?? "unknown";
}
