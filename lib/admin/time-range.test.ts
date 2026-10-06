import { describe, expect, it } from "vitest";

import { cacheSecondsFor, chartUnit, MAX_SPAN_MS, parseTimeRange } from "./time-range";

const NOW = new Date("2026-10-06T12:30:00.000Z"); // 15:30 in Nairobi

describe("presets use the server clock", () => {
  it("builds each preset from now", () => {
    expect(parseTimeRange({ range: "5m" }, NOW).start.toISOString()).toBe("2026-10-06T12:25:00.000Z");
    expect(parseTimeRange({ range: "1h" }, NOW).start.toISOString()).toBe("2026-10-06T11:30:00.000Z");
    expect(parseTimeRange({ range: "7d" }, NOW).start.toISOString()).toBe("2026-09-29T12:30:00.000Z");
    expect(parseTimeRange({ range: "30d" }, NOW).end).toEqual(NOW);
  });

  it("'today' starts at midnight in Nairobi (21:00 UTC the day before)", () => {
    expect(parseTimeRange({ range: "today" }, NOW).start.toISOString()).toBe("2026-10-05T21:00:00.000Z");
    // just after Nairobi midnight
    expect(parseTimeRange({ range: "today" }, new Date("2026-10-05T21:10:00.000Z")).start.toISOString()).toBe("2026-10-05T21:00:00.000Z");
  });

  it("unknown or missing presets fall back to 7 days", () => {
    expect(parseTimeRange({ range: "forever" }, NOW).key).toBe("7d");
    expect(parseTimeRange({}, NOW).key).toBe("7d");
  });
});

describe("custom ranges are validated and clamped", () => {
  it("accepts a normal range", () => {
    const r = parseTimeRange({ from: "2026-09-01T00:00:00Z", to: "2026-09-10T00:00:00Z" }, NOW);
    expect(r.custom).toBe(true);
    expect(r.start.toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(r.unit).toBe("day");
  });

  it("never ends in the future", () => {
    expect(parseTimeRange({ from: "2026-10-01T00:00:00Z", to: "2030-01-01T00:00:00Z" }, NOW).end).toEqual(NOW);
  });

  it("caps the span at 24 months", () => {
    const r = parseTimeRange({ from: "2000-01-01T00:00:00Z", to: "2026-10-01T00:00:00Z" }, NOW);
    expect(r.end.getTime() - r.start.getTime()).toBe(MAX_SPAN_MS);
  });

  it("treats a date-only end as the end of that day", () => {
    const r = parseTimeRange({ from: "2026-09-01", to: "2026-09-10" }, NOW);
    expect(r.end.toISOString()).toBe("2026-09-10T23:59:59.999Z");
  });

  it("rejects junk and backwards ranges by using the default", () => {
    expect(parseTimeRange({ from: "nope", to: "2026-09-10" }, NOW).custom).toBe(false);
    expect(parseTimeRange({ from: "2026-09-10", to: "2026-09-01" }, NOW).custom).toBe(false);
    expect(parseTimeRange({ from: "2031-01-01", to: "2032-01-01" }, NOW).custom).toBe(false); // entirely in the future
  });
});

describe("chart unit and cache lifetime", () => {
  const H = 3_600_000;
  const D = 24 * H;
  it("picks the unit by span", () => {
    expect(chartUnit(2 * H)).toBe("minute");
    expect(chartUnit(2 * H + 1)).toBe("hour");
    expect(chartUnit(3 * D)).toBe("hour");
    expect(chartUnit(3 * D + 1)).toBe("day");
    expect(chartUnit(120 * D)).toBe("day");
    expect(chartUnit(121 * D)).toBe("month");
  });

  it("caches short ranges briefly and long ones for 5 minutes", () => {
    expect(cacheSecondsFor(H)).toBe(30);
    expect(cacheSecondsFor(D)).toBe(60);
    expect(cacheSecondsFor(30 * D)).toBe(300);
  });
});
