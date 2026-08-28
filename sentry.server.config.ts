import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

/**
 * Initializes Sentry for the Node.js server runtime.
 *
 * Why it exists: request handlers, server actions, and route handlers all
 * run in this runtime — this is where payment webhooks, auth flows, and
 * DB writes fail, so it's the highest-value place to have error monitoring.
 *
 * Imported by `instrumentation.ts`'s `register()` only when
 * `NEXT_RUNTIME === "nodejs"`, per Sentry's current Next.js App Router
 * integration pattern (@sentry/nextjs 10.71.0).
 */
Sentry.init({
  // Passing `undefined` here is intentional and safe: the Sentry SDK
  // no-ops (creates a disabled client, sends nothing) instead of throwing
  // when no DSN is configured. SENTRY_DSN is optional until ops provisions
  // a Sentry project for this app.
  dsn: env.SENTRY_DSN,

  // Sample fewer transactions in prod to control cost/volume; capture
  // everything in dev where traffic is low and full visibility helps.
  tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

  beforeSend(event) {
    // Request bodies can carry user PII or Paystack/payment payloads —
    // never forward them to Sentry's third-party infrastructure.
    if (event.request?.data) {
      delete event.request.data;
    }
    return event;
  },
});
