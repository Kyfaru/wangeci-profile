import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

/**
 * One way to fail, one way to find out why.
 *  - AppError: an EXPECTED failure with a stable code (CHECKOUT_PAY_LOCKED, ORDER_NOT_FOUND ...). Answered
 *    with its own status and message, logged at warn level.
 *  - Anything else is a bug or an outage: logged with its request id, sent to Sentry, and answered with a
 *    generic message plus `requestId` so a person can quote it. A stack trace never leaves the server.
 * Every log line is one JSON object: {level, name, code, requestId, ...meta}.
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

const requestIdOf = (request?: Request) => request?.headers.get("x-request-id") || crypto.randomUUID();

/** Logs one structured line; unexpected errors also go to Sentry tagged with the request id. */
export function logError(name: string, error: unknown, meta: Record<string, unknown> = {}, requestId?: string) {
  const known = error instanceof AppError;
  const code = known ? error.code : "INTERNAL";
  const line = { level: known && error.status < 500 ? "warn" : "error", name, code, requestId, ...meta, ...(known ? error.meta : {}), message: error instanceof Error ? error.message : String(error) };
  (line.level === "warn" ? console.warn : console.error)(JSON.stringify(line));
  if (!known || error.status >= 500) Sentry.captureException(error, { tags: { name, code, requestId }, extra: meta });
  return { code, requestId };
}

/** Wraps a route handler: request id in, request id out, every failure traced and answered as JSON. */
export function api<R extends Request, C = unknown>(name: string, handler: (request: R, ctx: C) => Promise<Response>): (request: R, ctx: C) => Promise<Response> {
  return async (request, ctx) => {
    const requestId = requestIdOf(request);
    try {
      const response = await handler(request, ctx);
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      const { code } = logError(name, error, {}, requestId);
      const known = error instanceof AppError;
      return NextResponse.json(
        { error: known ? error.message : "Something went wrong. Please try again.", code, requestId },
        { status: known ? error.status : 500, headers: { "x-request-id": requestId } },
      );
    }
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
