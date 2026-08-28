import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

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
 */
Sentry.init({
  // `undefined` DSN is a supported no-op — see sentry.server.config.ts.
  dsn: env.SENTRY_DSN,

  tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,

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
