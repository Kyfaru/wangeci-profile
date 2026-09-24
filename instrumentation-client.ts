import * as Sentry from "@sentry/nextjs";

/**
 * Initializes Sentry for the browser.
 *
 * Why it exists: catches client-side errors (React render failures, failed
 * fetches from client components) that server-side monitoring never sees.
 *
 * File name/location note: as of @sentry/nextjs 10.71.0, the client SDK is
 * initialized from `instrumentation-client.ts` at the project root — this
 * is Next.js's own file convention (stable since Next 15.3, see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md),
 * not a Sentry-specific one. The older `sentry.client.config.ts` name still
 * works under webpack but is deprecated and explicitly does NOT work under
 * Turbopack (node_modules/@sentry/nextjs/build/cjs/config/webpack.js:213).
 * This diverges from the file name suggested in the task brief — flagged
 * here and in the final report.
 *
 * Deliberately does NOT import `@/lib/env` — that module's schema validates
 * server-only secrets (DATABASE_URL, PAYSTACK_SECRET_KEY, R2_*, etc.) via
 * `envSchema.parse(process.env)` at import time, and this file ships to the
 * browser. Next.js only inlines `NEXT_PUBLIC_*` vars into client bundles, so
 * every other var resolves to `undefined` there and `.parse()` throws on
 * every single page load, breaking all client-side interactivity site-wide
 * (found independently by two agents while verifying unrelated pages).
 * `NEXT_PUBLIC_SENTRY_DSN` isn't defined yet anywhere in this project, so
 * `dsn` below is a supported no-op until that's added — wiring up an actual
 * public DSN is a separate follow-up, not part of this fix.
 */
Sentry.init({
  // `undefined` DSN is a supported no-op — see sentry.server.config.ts.
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  integrations: [
    Sentry.replayIntegration({
      // Text stays visible in replays (this is an admin/backend platform,
      // not a form full of payment card numbers on screen); media is
      // blocked outright since it adds no debugging value and is the
      // more likely source of unexpectedly sensitive content.
      maskAllText: false,
      blockAllMedia: true,
    }),
  ],

  // Replays are expensive to store — sample a small slice of normal
  // sessions, but always capture the session when an error actually fires
  // since that's the one we'll want to watch.
  replaysSessionSampleRate: 0.02,
  replaysOnErrorSampleRate: 1.0,

  beforeSend(event) {
    // Mirrors the server/edge configs — strip request bodies before they
    // leave the browser for Sentry's infrastructure.
    if (event.request?.data) {
      delete event.request.data;
    }
    return event;
  },
});
