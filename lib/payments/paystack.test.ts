import crypto from "node:crypto";

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { PAYSTACK_SECRET_KEY: "sk_test_secret_key" } }));

import { paystack } from "./paystack";

const sign = (body: string, key = "sk_test_secret_key") => crypto.createHmac("sha512", key).update(body).digest("hex");
const headers = (sig?: string) => new Headers(sig ? { "x-paystack-signature": sig } : {});

describe("paystack webhook signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "r1", amount: 50000, currency: "KES" } });

  it("accepts a correctly signed body", () => {
    expect(paystack.verifyWebhook(body, headers(sign(body)))).toBe(true);
  });

  it("rejects a wrong signature, a different key, a changed body, a missing header and garbage", () => {
    expect(paystack.verifyWebhook(body, headers(sign(body, "sk_test_other")))).toBe(false);
    expect(paystack.verifyWebhook(body + " ", headers(sign(body)))).toBe(false);
    expect(paystack.verifyWebhook(body, headers())).toBe(false);
    expect(paystack.verifyWebhook(body, headers("not-hex-at-all"))).toBe(false);
    expect(paystack.verifyWebhook(body, headers("abcd"))).toBe(false); // short: must not crash timingSafeEqual
  });
});

describe("paystack parseEvent", () => {
  it("converts cents to shillings and reads the reference", () => {
    expect(paystack.parseEvent({ event: "charge.success", data: { reference: "r1", amount: 150050, currency: "KES" } })).toEqual({
      type: "payment.succeeded",
      provider: "PAYSTACK",
      reference: "r1",
      amount: 1500.5,
      currency: "KES",
    });
  });

  it("understands refund events and ignores everything else", () => {
    expect(paystack.parseEvent({ event: "refund.processed", data: { transaction_reference: "r1" } })).toMatchObject({ type: "refund.processed", reference: "r1" });
    expect(paystack.parseEvent({ event: "refund.failed", data: { transaction: { reference: "r2" } } })).toMatchObject({ type: "refund.failed", reference: "r2" });
    expect(paystack.parseEvent({ event: "transfer.success", data: {} })).toEqual({ type: "ignored" });
    expect(paystack.parseEvent({ event: "charge.success", data: { reference: "r1" } })).toEqual({ type: "ignored" }); // missing fields
    expect(paystack.parseEvent(null)).toEqual({ type: "ignored" });
  });
});
