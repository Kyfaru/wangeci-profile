/**
 * One object for "which period am I looking at". The SERVER clock decides what "now" is (a browser
 * clock can be wrong or faked), presets are named, custom ranges are validated and capped at 24 months,
 * and the chart unit and the cache lifetime follow from the length of the period.
 */
export const PRESETS = ["5m", "1h", "today", "7d", "30d", "6mo", "12mo"] as const;
export type Preset = (typeof PRESETS)[number];
export type ChartUnit = "minute" | "hour" | "day" | "month";

export const PRESET_LABELS: Record<Preset, string> = {
  "5m": "Last 5 minutes",
  "1h": "Last hour",
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "6mo": "Last 6 months",
  "12mo": "Last 12 months",
};

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NAIROBI_OFFSET = 3 * HOUR; // Kenya has no daylight saving: always UTC+3
export const MAX_SPAN_MS = Math.round(24 * 30.44 * DAY); // 24 months, in whole milliseconds

export interface TimeRange {
  start: Date;
  end: Date;
  /** How wide one bar of a chart is. */
  unit: ChartUnit;
  label: string;
  /** How long a computed result for this range may be reused (seconds). */
  cacheSeconds: number;
  /** A stable key for caches: preset name or the exact custom bounds. */
  key: string;
  custom: boolean;
}

/** minute up to 2 hours, hour up to 3 days, day up to 120 days, month beyond. */
export function chartUnit(spanMs: number): ChartUnit {
  if (spanMs <= 2 * HOUR) return "minute";
  if (spanMs <= 3 * DAY) return "hour";
  if (spanMs <= 120 * DAY) return "day";
  return "month";
}

/** Short ranges change fast (30 to 60 seconds), long ones can be reused for 5 minutes. */
export function cacheSecondsFor(spanMs: number): number {
  if (spanMs <= 2 * HOUR) return 30;
  if (spanMs <= 3 * DAY) return 60;
  return 300;
}

const startOfTodayNairobi = (now: Date) => new Date(Math.floor((now.getTime() + NAIROBI_OFFSET) / DAY) * DAY - NAIROBI_OFFSET);

function presetStart(preset: Preset, now: Date): Date {
  const t = now.getTime();
  switch (preset) {
    case "5m": return new Date(t - 5 * MIN);
    case "1h": return new Date(t - HOUR);
    case "today": return startOfTodayNairobi(now);
    case "7d": return new Date(t - 7 * DAY);
    case "30d": return new Date(t - 30 * DAY);
    case "6mo": return new Date(t - Math.round(6 * 30.44 * DAY));
    case "12mo": return new Date(t - Math.round(12 * 30.44 * DAY));
  }
}

function build(start: Date, end: Date, label: string, key: string, custom: boolean): TimeRange {
  const span = end.getTime() - start.getTime();
  return { start, end, unit: chartUnit(span), label, cacheSeconds: cacheSecondsFor(span), key, custom };
}

export const isPreset = (v: unknown): v is Preset => typeof v === "string" && (PRESETS as readonly string[]).includes(v);

/**
 * Turns what the browser asked for (a preset name, or custom from/to) into a TimeRange.
 * Anything invalid falls back to the last 7 days. A custom range is clamped: the end can never be in
 * the future, the start can never be earlier than 24 months before the end, and start must be before end.
 * Only the NAME of a preset travels from the browser, never timestamps for presets.
 */
export function parseTimeRange(input: { range?: string | null; from?: string | null; to?: string | null }, now: Date = new Date()): TimeRange {
  if (input.from && input.to) {
    const from = new Date(input.from);
    // A date-only "to" (from the date picker) means the END of that day.
    const to = new Date(/^\d{4}-\d{2}-\d{2}$/.test(input.to) ? `${input.to}T23:59:59.999Z` : input.to);
    if (Number.isFinite(from.getTime()) && Number.isFinite(to.getTime()) && from < to) {
      const end = to > now ? now : to;
      const earliest = new Date(end.getTime() - MAX_SPAN_MS);
      const start = from < earliest ? earliest : from;
      if (start < end) return build(start, end, "Custom range", `c:${start.toISOString()}:${end.toISOString()}`, true);
    }
  }
  const preset: Preset = isPreset(input.range) ? input.range : "7d";
  return build(presetStart(preset, now), now, PRESET_LABELS[preset], preset, false);
}
