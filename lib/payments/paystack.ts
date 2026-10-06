import crypto from "node:crypto";

import { env } from "@/lib/env";
import { ProviderError, type PaymentProvider, type ProviderEvent, type VerifyResult } from "@/lib/payments/types";

// Verified against https://paystack.com/docs/payments/webhooks/ , /docs/api/transaction/ and
// /docs/api/refund/ on 2026-10-06:
//  - signature: header x-paystack-signature = HMAC-SHA512 of the raw body, keyed with the SECRET KEY
//  - events used: charge.success, refund.processed, refund.failed (there is NO charge.failed event;
//    failed or abandoned payments are discovered with GET /transaction/verify/:reference)
//  - amount is in the smallest currency unit (KES cents); verify returns data.status "success" | "failed" | "abandoned"
//  - POST /refund { transaction, amount?, merchant_note }; statuses pending, processing, processed, needs-attention
// UNVERIFIED: the exact field that carries the original transaction reference in refund.* payloads
// (Paystack publishes no sample). parseEvent accepts the likely names, and the match is only
// honoured for orders where we ourselves asked for a refund.
const BASE = "https://api.paystack.co";

const toMinor = (major: number) => Math.round(major * 100);
const toMajor = (minor: number) => minor / 100;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json", ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !json?.status) throw new ProviderError(`Paystack ${path} failed: ${json?.message ?? res.status}`);
  return json.data as T;
}

type VerifyData = { status: string; amount: number; currency: string; reference: string; gateway_response?: string };

export const paystack: PaymentProvider = {
  id: "PAYSTACK",

  async initialize({ orderId, reference, amount, currency, buyer, returnUrl }) {
    const data = await call<{ authorization_url: string; access_code: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: buyer.email,
        amount: toMinor(amount),
        currency,
        reference,
        callback_url: returnUrl,
        metadata: { orderId },
      }),
    });
    return { reference: data.reference ?? reference, redirectUrl: data.authorization_url, accessCode: data.access_code };
  },

  verifyWebhook(rawBody, headers) {
    const given = headers.get("x-paystack-signature");
    if (!given) return false;
    const expected = crypto.createHmac("sha512", env.PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(given, "hex");
    // timingSafeEqual throws on different lengths, so check first (a garbled header must not crash us).
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  },

  parseEvent(payload): ProviderEvent {
    const p = payload as { event?: string; data?: Record<string, unknown> } | null;
    const data = p?.data ?? {};
    switch (p?.event) {
      case "charge.success": {
        if (typeof data.reference !== "string" || typeof data.amount !== "number" || typeof data.currency !== "string") return { type: "ignored" };
        return { type: "payment.succeeded", provider: "PAYSTACK", reference: data.reference, amount: toMajor(data.amount), currency: data.currency };
      }
      case "refund.processed":
      case "refund.failed": {
        const nested = data.transaction as { reference?: unknown } | undefined;
        const ref = [data.transaction_reference, nested?.reference, data.reference].find((v): v is string => typeof v === "string");
        if (!ref) return { type: "ignored" };
        return { type: p.event === "refund.processed" ? "refund.processed" : "refund.failed", provider: "PAYSTACK", reference: ref };
      }
      default:
        return { type: "ignored" };
    }
  },

  async verify(reference): Promise<VerifyResult> {
    const data = await call<VerifyData>(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (data.status === "success") return { state: "success", amount: toMajor(data.amount), currency: data.currency };
    if (data.status === "failed" || data.status === "abandoned") return { state: "failed", reason: data.gateway_response ?? data.status };
    return { state: "pending" };
  },

  async refund({ reference, amount, reason }) {
    await call("/refund", { method: "POST", body: JSON.stringify({ transaction: reference, amount: toMinor(amount), merchant_note: reason.slice(0, 200) }) });
    return { ok: true };
  },
};
