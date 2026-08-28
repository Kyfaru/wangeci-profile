import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

/**
 * Initializes Sentry for the Edge runtime.
 *
 * Why it exists: this app's `proxy.ts` (Next 16's middleware.ts
 * replacement) currently runs Node.js-only, and there are no edge route
 * handlers yet — so this mainly exists so any future edge runtime code
 * (or Vercel Edge Middleware, if adopted later) is already covered rather
 * than silently unmonitored.
 *
 * Imported by `instrumentation.ts`'s `register()` only when
 * `NEXT_RUNTIME === "edge"`, per Sentry's current Next.js App Router
 * integration pattern (@sentry/nextjs 10.71.0).
 */
Sentry.init({
  // See sentry.server.config.ts — `undefined` DSN is a supported no-op,
  // not a crash, so boot is never blocked by a missing SENTRY_DSN.
  dsn: env.SENTRY_DSN,

  tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

  beforeSend(event) {
    // Same PII/payment-payload concern as the server config — the edge
    // runtime can see request data too (e.g. proxy/middleware bodies).
    if (event.request?.data) {
      delete event.request.data;
    }
    return event;
  },
});
