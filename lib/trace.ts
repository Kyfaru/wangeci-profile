import { AsyncLocalStorage } from "node:async_hooks";
import { timingSafeEqual } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * One way to fail, one way to find out why.
 *  - AppError: an EXPECTED failure with a stable code (CHECKOUT_PAY_LOCKED, ORDER_NOT_FOUND ...). Answered
 *    with its own status and message, logged at warn level.
 *  - Anything else is a bug or an outage: logged with its request id, sent to Sentry, and answered with a
 *    generic message plus `requestId` so a person can quote it. A stack trace never leaves the server.
 * Every log line is one JSON object: {level, name, code, requestId, ...meta}.
 * Trace names are `domain.step` (checkout.pay, webhooks.resend.post).
 */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/** The request id of the call being handled, so logError/traced inside handlers carry it without plumbing. */
const currentRequest = new AsyncLocalStorage<string>();

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/; // a caller-supplied id lands in logs and headers, so it must be boring
const MAX_META_CHARS = 200;
const MAX_SCRUB_DEPTH = 4;
const EMAIL = /[^\s@"'<>]+@[^\s@"'<>]+\.[^\s@"'<>]+/g;
const PHONE = /(?:\+|\b0|\b254)\d[\d\s-]{7,}\d/g; // +254..., 07..., 254...: leaves ids and timestamps alone
const LONG_TOKEN = /[A-Za-z0-9_-]{40,}/g; // longer than a UUID, so ids survive and API keys do not

const requestIdOf = (request?: Request) => {
  const given = request?.headers.get("x-request-id") ?? "";
  return REQUEST_ID_PATTERN.test(given) ? given : crypto.randomUUID();
};

/** Hides emails, phone numbers and long secrets in a string, and cuts it to 200 characters. */
function scrubString(value: string): string {
  const clean = value.replace(EMAIL, "[email]").replace(LONG_TOKEN, "[token]").replace(PHONE, "[phone]");
  return clean.length > MAX_META_CHARS ? `${clean.slice(0, MAX_META_CHARS)}...` : clean;
}

function scrub(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return scrubString(value);
  if (value === null || typeof value !== "object") return value;
  if (depth >= MAX_SCRUB_DEPTH) return "[deep]";
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => scrub(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v, depth + 1)]));
}

/** Constant-time string comparison for secrets, tokens and signatures. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Logs one structured line; unexpected errors also go to Sentry tagged with the request id. */
export function logError(name: string, error: unknown, meta: Record<string, unknown> = {}, requestId?: string) {
  const known = error instanceof AppError;
  const code = known ? error.code : "INTERNAL";
  const safeMeta = scrub({ ...meta, ...(known ? error.meta : {}) }) as Record<string, unknown>;
  const message = scrubString(error instanceof Error ? error.message : String(error));
  requestId ??= currentRequest.getStore();
  const line = { level: known && error.status < 500 ? "warn" : "error", name, code, requestId, ...safeMeta, message };
  (line.level === "warn" ? console.warn : console.error)(JSON.stringify(line));
  if (!known || error.status >= 500) Sentry.captureException(error, { tags: { name, code, requestId }, extra: safeMeta });
  return { code, requestId };
}

/** Wraps a route handler: request id in, request id out, every failure traced and answered as JSON. */
export function api<R extends Request, C = unknown>(name: string, handler: (request: R, ctx: C) => Promise<Response>): (request: R, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const requestId = requestIdOf(request);
    return currentRequest.run(requestId, async () => {
      try {
        const response = await handler(request, ctx);
        response.headers.set("x-request-id", requestId);
        if (response.status < 400) return response;
        // A returned 4xx/5xx is a failure too: log one line and make sure the body carries the request id.
        const body = (await response.clone().json().catch(() => null)) as Record<string, unknown> | null;
        logError(name, new AppError(typeof body?.code === "string" ? body.code : `HTTP_${response.status}`, typeof body?.error === "string" ? body.error : "returned error response", response.status), {}, requestId);
        if (!body || typeof body !== "object" || "requestId" in body) return response;
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        return NextResponse.json({ ...body, requestId }, { status: response.status, headers });
      } catch (error) {
        const { code } = logError(name, error, {}, requestId);
        const known = error instanceof AppError;
        const headers: Record<string, string> = { "x-request-id": requestId };
        if (known && error.status === 429 && error.meta?.retryAfter) headers["Retry-After"] = String(error.meta.retryAfter);
        return NextResponse.json(
          { error: known ? error.message : "Something went wrong. Please try again.", code, requestId },
          { status: known ? error.status : 500, headers },
        );
      }
    });
  };
}

/**
 * Runs a background step (post-payment email, admin alert, cleanup). Never throws: a failure is traced
 * and returns `fallback`, so one broken step cannot undo a payment or hide the others.
 */
export async function traced<T>(name: string, fn: () => Promise<T>, meta: Record<string, unknown> = {}, fallback?: T): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logError(name, error, meta);
    return fallback;
  }
}
