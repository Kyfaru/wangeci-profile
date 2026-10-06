import crypto from "node:crypto";

import { getKv } from "@/lib/auth/kv";
import { env } from "@/lib/env";
import { ProviderError, type PaymentProvider, type ProviderEvent, type VerifyResult } from "@/lib/payments/types";

// M-Pesa Express (STK push) through Safaricom Daraja.
// UNVERIFIED AGAINST OFFICIAL DOCS: developer.safaricom.co.ke could not be fetched (HTTP 404 for the
// docs page). The shapes below come from widely used Daraja integrations and must be confirmed in the
// Daraja SANDBOX (and then with one real KES 1 payment) before launch:
//   - OAuth:   GET  /oauth/v1/generate?grant_type=client_credentials  (Basic auth, consumer key:secret)
//   - STK:     POST /mpesa/stkpush/v1/processrequest
//   - Query:   POST /mpesa/stkpushquery/v1/query
//   - Password = base64(Shortcode + Passkey + Timestamp), Timestamp = yyyyMMddHHmmss
//   - Callback: { Body: { stkCallback: { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc,
//                CallbackMetadata: { Item: [{ Name, Value }] } } } }, ResultCode 0 = paid
// Safaricom does NOT sign callbacks, so (1) the callback URL has a secret in its path, (2) the route
// answers only to that path, and (3) a "paid" callback is never trusted by itself: we confirm it with
// the STK query API (server to server) before granting access.

const baseUrl = () => (env.DARAJA_ENV === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke");

export const mpesaConfigured = () =>
  Boolean(env.DARAJA_CONSUMER_KEY && env.DARAJA_CONSUMER_SECRET && env.DARAJA_SHORTCODE && env.DARAJA_PASSKEY && env.DARAJA_CALLBACK_TOKEN);

/** Daraja timestamps are yyyyMMddHHmmss (Nairobi time). */
export function timestamp(now = new Date()): string {
  const nairobi = new Date(now.getTime() + 3 * 3600_000);
  return nairobi.toISOString().replace(/[-T:]/g, "").slice(0, 14);
}

export const stkPassword = (shortcode: string, passkey: string, ts: string) => Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

/** "+254712345678" -> "254712345678". Only Kenyan mobile numbers can pay with M-Pesa. */
export function toMpesaPhone(e164: string): string | null {
  return /^\+254[17]\d{8}$/.test(e164) ? e164.slice(1) : null;
}

async function accessToken(): Promise<string> {
  const key = env.DARAJA_CONSUMER_KEY!.trim();
  const secret = env.DARAJA_CONSUMER_SECRET!.trim();
  // The cache key includes the base URL and the credentials, so a token from sandbox (or from old
  // credentials) can never be served to a production request.
  const cacheKey = `mpesa:token:${crypto.createHash("sha256").update(`${baseUrl()}|${key}|${secret}`).digest("hex").slice(0, 24)}`;
  const kv = getKv();
  const cached = await kv.get<string>(cacheKey);
  if (cached) return cached;

  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: string } | null;
  if (!res.ok || !json?.access_token) throw new ProviderError(`M-Pesa token request failed (${res.status})`);
  await kv.set(cacheKey, json.access_token, Math.max(60, Number(json.expires_in ?? 3599) - 120));
  return json.access_token;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const call = async (token: string) =>
    fetch(`${baseUrl()}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  let res = await call(await accessToken());
  if (res.status === 401) {
    // A cached token can go stale early: drop it by fetching a fresh one once.
    await getKv().del(`mpesa:token:${crypto.createHash("sha256").update(`${baseUrl()}|${env.DARAJA_CONSUMER_KEY!.trim()}|${env.DARAJA_CONSUMER_SECRET!.trim()}`).digest("hex").slice(0, 24)}`);
    res = await call(await accessToken());
  }
  const json = (await res.json().catch(() => null)) as T & { errorCode?: string; errorMessage?: string } | null;
  if (!json) throw new ProviderError(`M-Pesa ${path} returned no JSON (${res.status})`);
  return json;
}

function callbackBody(payload: unknown) {
  const cb = (payload as { Body?: { stkCallback?: Record<string, unknown> } } | null)?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== "string" || (typeof cb.ResultCode !== "number" && typeof cb.ResultCode !== "string")) return null;
  const items = ((cb.CallbackMetadata as { Item?: { Name: string; Value?: unknown }[] } | undefined)?.Item ?? []).reduce<Record<string, unknown>>((acc, i) => {
    acc[i.Name] = i.Value;
    return acc;
  }, {});
  return { checkoutRequestId: cb.CheckoutRequestID, resultCode: Number(cb.ResultCode), resultDesc: String(cb.ResultDesc ?? ""), items };
}

export const mpesa: PaymentProvider = {
  id: "MPESA",

  async initialize({ orderId, amount, buyer }) {
    if (!mpesaConfigured()) throw new ProviderError("M-Pesa is not configured");
    const phone = buyer.phone ? toMpesaPhone(buyer.phone) : null;
    if (!phone) throw new ProviderError("A Kenyan M-Pesa phone number is required");
    if (!Number.isInteger(amount) || amount < 1) throw new ProviderError("M-Pesa amounts must be whole shillings");

    const ts = timestamp();
    const shortcode = env.DARAJA_SHORTCODE!;
    const res = await post<{ MerchantRequestID?: string; CheckoutRequestID?: string; ResponseCode?: string; ResponseDescription?: string; errorMessage?: string }>(
      "/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: shortcode,
        Password: stkPassword(shortcode, env.DARAJA_PASSKEY!, ts),
        Timestamp: ts,
        TransactionType: env.DARAJA_TRANSACTION_TYPE,
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: `${env.BETTER_AUTH_URL}/api/webhooks/mpesa/${env.DARAJA_CALLBACK_TOKEN}`,
        AccountReference: orderId.slice(-12),
        TransactionDesc: "Book purchase",
      },
    );
    if (res.ResponseCode !== "0" || !res.CheckoutRequestID) {
      throw new ProviderError(`M-Pesa refused the request: ${res.errorMessage ?? res.ResponseDescription ?? "unknown"}`);
    }
    return { reference: res.CheckoutRequestID, merchantRequestId: res.MerchantRequestID };
  },

  // The only "signature" is the secret path segment; the route checks it (see verifyCallbackToken).
  verifyWebhook() {
    return true;
  },

  parseEvent(payload): ProviderEvent {
    const cb = callbackBody(payload);
    if (!cb) return { type: "ignored" };
    if (cb.resultCode === 0) {
      const amount = Number(cb.items.Amount);
      const phone = cb.items.PhoneNumber ? `+${String(cb.items.PhoneNumber)}` : undefined;
      if (!Number.isFinite(amount)) return { type: "ignored" };
      return { type: "payment.succeeded", provider: "MPESA", reference: cb.checkoutRequestId, amount, currency: "KES", receipt: cb.items.MpesaReceiptNumber ? String(cb.items.MpesaReceiptNumber) : undefined, payerPhone: phone };
    }
    // Any non-zero ResultCode: cancelled (1032), wrong PIN (2001), insufficient funds (1), timeout (1037), ...
    return { type: "payment.failed", provider: "MPESA", reference: cb.checkoutRequestId, reason: `${cb.resultCode}: ${cb.resultDesc}` };
  },

  async verify(reference): Promise<VerifyResult> {
    const ts = timestamp();
    const res = await post<{ ResultCode?: string | number; ResultDesc?: string; errorCode?: string; errorMessage?: string }>("/mpesa/stkpushquery/v1/query", {
      BusinessShortCode: env.DARAJA_SHORTCODE,
      Password: stkPassword(env.DARAJA_SHORTCODE!, env.DARAJA_PASSKEY!, ts),
      Timestamp: ts,
      CheckoutRequestID: reference,
    });
    if (res.ResultCode === undefined) return { state: "pending" }; // for example "the transaction is being processed"
    const code = Number(res.ResultCode);
    if (code === 0) return { state: "success" }; // the query has no amount; the amount we requested is the amount paid
    return { state: "failed", reason: `${code}: ${res.ResultDesc ?? ""}` };
  },

  // M-Pesa money is sent back by a person (reversal in the Safaricom portal or a manual payment) and
  // then recorded by the owner. There is no automatic refund here.
  async refund() {
    return { ok: false, manual: true };
  },
};

/** Constant-time check of the secret segment in /api/webhooks/mpesa/<token>. */
export function verifyCallbackToken(given: string): boolean {
  const expected = env.DARAJA_CALLBACK_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
