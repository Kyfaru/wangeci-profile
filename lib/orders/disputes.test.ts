import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { NODE_ENV: "test", PAYSTACK_SECRET_KEY: "sk_test_x" } }));

import { paystack } from "@/lib/payments/paystack";

describe("paystack dispute and refund-state events", () => {
  it("parses dispute create/resolve from the nested transaction reference", () => {
    expect(paystack.parseEvent({ event: "charge.dispute.create", data: { transaction: { reference: "r1" } } })).toEqual({ type: "dispute.opened", provider: "PAYSTACK", reference: "r1" });
    expect(paystack.parseEvent({ event: "charge.dispute.resolve", data: { transaction: { reference: "r1" }, resolution: "declined" } })).toEqual({
      type: "dispute.resolved",
      provider: "PAYSTACK",
      reference: "r1",
      resolution: "declined",
    });
  });

  it("ignores reminders, disputes without a reference, and in-flight refund states", () => {
    expect(paystack.parseEvent({ event: "charge.dispute.remind", data: { transaction: { reference: "r1" } } })).toEqual({ type: "ignored" });
    expect(paystack.parseEvent({ event: "charge.dispute.create", data: { transaction: 123 } })).toEqual({ type: "ignored" });
    expect(paystack.parseEvent({ event: "refund.pending", data: { transaction_reference: "r1" } })).toEqual({ type: "ignored" });
    expect(paystack.parseEvent({ event: "refund.processing", data: { transaction_reference: "r1" } })).toEqual({ type: "ignored" });
  });
});
