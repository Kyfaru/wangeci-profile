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

  it("discounts are whole shillings (M-Pesa cannot collect cents), without float errors", () => {
    expect(checkCoupon(rule({ value: 33.33 }), 99.99, NOW)).toEqual({ ok: true, discount: 33 });
    expect(checkCoupon(rule({ value: 15 }), 999, NOW)).toEqual({ ok: true, discount: 150 }); // 149.85 rounds up
    expect(checkCoupon(rule({ type: "FIXED", value: 10.4 }), 500, NOW)).toEqual({ ok: true, discount: 10 });
    expect(Number.isInteger(totals({ subtotal: 999, discount: 150, feePercent: 2.5 }).total)).toBe(true);
  });

  it("refuses unknown, inactive, early, expired, used-up and too-small-basket codes with ONE message", () => {
    const refusals = [
      checkCoupon(null, 1000, NOW),
      checkCoupon(rule({ isActive: false }), 1000, NOW),
      checkCoupon(rule({ startsAt: new Date("2026-11-01") }), 1000, NOW),
      checkCoupon(rule({ endsAt: new Date("2026-10-01") }), 1000, NOW),
      checkCoupon(rule({ maxRedemptions: 5, used: 5 }), 1000, NOW),
      checkCoupon(rule({ minSubtotal: 1500 }), 1000, NOW),
    ];
    for (const r of refusals) expect(r).toEqual({ ok: false, reason: "That code is not valid." }); // no case can be told apart
    expect(checkCoupon(rule({ maxRedemptions: 5, used: 4 }), 1000, NOW)).toMatchObject({ ok: true });
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

  it("the fee is a whole number of shillings", () => {
    expect(feeFor(999, 2.5)).toBe(25); // 24.975
    expect(totals({ subtotal: 999, discount: 0, feePercent: 2.5 }).total).toBe(1024);
  });

  it("the fee is a whole number of shillings", () => {
    expect(feeFor(999, 2.5)).toBe(25); // 24.975
    expect(totals({ subtotal: 999, discount: 0, feePercent: 2.5 }).total).toBe(1024);
  });

  it("no fee for a zero or negative percentage", () => {
    expect(feeFor(1000, 0)).toBe(0);
    expect(feeFor(1000, -5)).toBe(0);
  });
});
