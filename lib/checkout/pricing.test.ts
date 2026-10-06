import { describe, expect, it } from "vitest";

import { checkCoupon, feeFor, totals, type CouponRule } from "./pricing";

const NOW = new Date("2026-10-06T12:00:00Z");
const rule = (over: Partial<CouponRule> = {}): CouponRule => ({ code: "WELCOME10", type: "PERCENT", value: 10, minSubtotal: null, maxRedemptions: null, used: 0, startsAt: null, endsAt: null, isActive: true, ...over });

describe("coupons", () => {
  it("percent and fixed discounts", () => {
    expect(checkCoupon(rule(), 2000, NOW)).toEqual({ ok: true, discount: 200 });
    expect(checkCoupon(rule({ type: "FIXED", value: 300 }), 2000, NOW)).toEqual({ ok: true, discount: 300 });
  });

  it("never discounts below zero", () => {
    expect(checkCoupon(rule({ type: "FIXED", value: 5000 }), 2000, NOW)).toEqual({ ok: true, discount: 2000 });
    expect(checkCoupon(rule({ value: 250 }), 2000, NOW)).toEqual({ ok: true, discount: 2000 }); // percent capped at 100
  });

  it("rounds to the cent without float errors", () => {
    expect(checkCoupon(rule({ value: 33.33 }), 99.99, NOW)).toEqual({ ok: true, discount: 33.33 });
    expect(checkCoupon(rule({ value: 10 }), 0.07, NOW)).toEqual({ ok: true, discount: 0.01 });
  });

  it("refuses unknown, inactive, early, expired, used-up and too-small-basket codes", () => {
    expect(checkCoupon(null, 1000, NOW)).toMatchObject({ ok: false });
    expect(checkCoupon(rule({ isActive: false }), 1000, NOW)).toMatchObject({ ok: false, reason: "That code is not valid." });
    expect(checkCoupon(rule({ startsAt: new Date("2026-11-01") }), 1000, NOW)).toMatchObject({ ok: false, reason: "That code is not active yet." });
    expect(checkCoupon(rule({ endsAt: new Date("2026-10-01") }), 1000, NOW)).toMatchObject({ ok: false, reason: "That code has expired." });
    expect(checkCoupon(rule({ maxRedemptions: 5, used: 5 }), 1000, NOW)).toMatchObject({ ok: false, reason: "That code has been fully used." });
    expect(checkCoupon(rule({ maxRedemptions: 5, used: 4 }), 1000, NOW)).toMatchObject({ ok: true });
    expect(checkCoupon(rule({ minSubtotal: 1500 }), 1000, NOW)).toMatchObject({ ok: false });
  });
});

describe("totals", () => {
  it("subtotal minus discount plus fee", () => {
    expect(totals({ subtotal: 2000, discount: 200, feePercent: 0 })).toEqual({ subtotal: 2000, discount: 200, fee: 0, total: 1800 });
    expect(totals({ subtotal: 2000, discount: 200, feePercent: 2.5 })).toEqual({ subtotal: 2000, discount: 200, fee: 45, total: 1845 });
  });

  it("a full discount gives a total of zero (a free order)", () => {
    expect(totals({ subtotal: 500, discount: 500, feePercent: 3 })).toEqual({ subtotal: 500, discount: 500, fee: 0, total: 0 });
  });

  it("a discount larger than the subtotal is clamped", () => {
    expect(totals({ subtotal: 100, discount: 999, feePercent: 0 }).total).toBe(0);
  });

  it("no fee for a zero or negative percentage", () => {
    expect(feeFor(1000, 0)).toBe(0);
    expect(feeFor(1000, -5)).toBe(0);
  });
});
