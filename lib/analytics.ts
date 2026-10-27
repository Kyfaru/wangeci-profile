// Pure types and a pure parser, shared with the admin Overview that calls this file.
// eslint-disable-next-line no-restricted-imports
import type { ChartUnit, TimeRange } from "@/lib/admin/time-range";
import { getKv } from "@/lib/auth/kv";
import { env } from "@/lib/env";
import { AppError, traced } from "@/lib/trace";

/**
 * Read-only Umami (hosted) statistics for the admin Overview. Everything here is absent when
 * UMAMI_API_KEY / UMAMI_WEBSITE_ID are not set, and a failed call returns undefined after being traced,
 * so analytics can never break the page it sits on. Umami holds page paths and event NAMES only.
 * NOTE: response shapes follow the Umami v2 API from memory (the official reference could not be read
 * when this was written); every read is defensive about number-vs-{value} and missing fields.
 */
const TIMEOUT_MS = 5000; // a slow analytics host must not hold the dashboard up
const ACTIVE_CACHE_SECONDS = 15;
const TIMEZONE = "Africa/Nairobi";

export const analyticsConfigured = () => Boolean(env.UMAMI_API_KEY && env.UMAMI_WEBSITE_ID);

async function umami<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = `${env.UMAMI_API_URL}/websites/${env.UMAMI_WEBSITE_ID}/${path}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const response = await fetch(url, {
    // Umami Cloud documents the API key as a bearer token; self-hosted accepts the same.
    headers: { accept: "application/json", authorization: `Bearer ${env.UMAMI_API_KEY}`, "x-umami-api-key": env.UMAMI_API_KEY ?? "" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new AppError("ANALYTICS_UMAMI_FAILED", "Umami request failed.", 502, { path, status: response.status });
  return (await response.json()) as T;
}

/** Reuse a result briefly (same idea as lib/admin/stats.ts) and trace-and-swallow any failure. */
async function read<T>(name: string, key: string, seconds: number, fetcher: () => Promise<T>): Promise<T | undefined> {
  if (!analyticsConfigured()) return undefined;
  return traced(`analytics.${name}`, async () => {
    const kv = getKv();
    const hit = await kv.get<T>(`umami:${name}:${key}`);
    if (hit) return hit;
    const value = await fetcher();
    await kv.set(`umami:${name}:${key}`, value, seconds);
    return value;
  });
}

const bounds = (r: TimeRange) => ({ startAt: r.start.getTime(), endAt: r.end.getTime() });
const num = (v: unknown): number => (typeof v === "number" ? v : v && typeof v === "object" && "value" in v ? Number((v as { value: unknown }).value) || 0 : 0);

export interface TrafficStats {
  visitors: number;
  pageviews: number;
}

/** Visitors and page views in the range. */
export const stats = (range: TimeRange) =>
  read<TrafficStats>("stats", range.key, range.cacheSeconds, async () => {
    const r = await umami<Record<string, unknown>>("stats", bounds(range));
    return { visitors: num(r.visitors), pageviews: num(r.pageviews) };
  });

/** Most viewed paths in the range. */
export const topPages = (range: TimeRange, limit = 5) =>
  read<{ path: string; views: number }[]>("pages", `${range.key}:${limit}`, range.cacheSeconds, async () => {
    const rows = await umami<{ x: string; y: number }[]>("metrics", { ...bounds(range), type: "path", limit });
    return rows.slice(0, limit).map((r) => ({ path: String(r.x), views: Number(r.y) || 0 }));
  });

/** Visitors on the site right now. */
export const active = () =>
  read<number>("active", "now", ACTIVE_CACHE_SECONDS, async () => {
    const r = await umami<{ visitors?: number; x?: number }>("active", {});
    return Number(r.visitors ?? r.x ?? 0);
  });

/** Named events (the data-umami-event buttons) and how often each fired. */
export const events = (range: TimeRange, limit = 5) =>
  read<{ name: string; count: number }[]>("events", `${range.key}:${limit}`, range.cacheSeconds, async () => {
    const rows = await umami<{ x: string; y: number }[]>("metrics", { ...bounds(range), type: "event", limit });
    return rows.slice(0, limit).map((r) => ({ name: String(r.x), count: Number(r.y) || 0 }));
  });

/** Page views per bucket. Umami has no minute bucket on every plan, so minutes are asked for as hours. */
export const series = (range: TimeRange, unit: ChartUnit) =>
  read<{ t: string; views: number }[]>("series", `${range.key}:${unit}`, range.cacheSeconds, async () => {
    const r = await umami<{ pageviews?: { x: string; y: number }[] }>("pageviews", {
      ...bounds(range),
      unit: unit === "minute" ? "hour" : unit,
      timezone: TIMEZONE,
    });
    return (r.pageviews ?? []).map((p) => ({ t: String(p.x), views: Number(p.y) || 0 }));
  });

/** Everything the Overview cards need, fetched together. Returns null when analytics is not configured. */
export async function overview(range: TimeRange) {
  if (!analyticsConfigured()) return null;
  const [online, pages, clicks, traffic, bars] = await Promise.all([active(), topPages(range), events(range), stats(range), series(range, range.unit)]);
  return { online, pages, clicks, traffic, bars };
}
