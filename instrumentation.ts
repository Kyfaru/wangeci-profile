import { captureRequestError } from "@sentry/nextjs";

/**
 * Registers Sentry for whichever server runtime Next.js is currently
 * booting into.
 *
 * Why it exists: `sentry.server.config.ts` and `sentry.edge.config.ts` are
 * plain modules — nothing loads them automatically. Next.js's own
 * `instrumentation.ts` `register()` hook (stable since Next 15) is the
 * documented place to import them, gated on `NEXT_RUNTIME` so the Node
 * SDK never gets bundled into the Edge runtime and vice versa. This is
 * still Sentry's current @sentry/nextjs 10.71.0 pattern for server/edge —
 * only the client file changed (see instrumentation-client.ts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forwards server-side rendering/route-handler errors (that Next.js
// catches itself, e.g. thrown during a Server Component render) to
// whichever Sentry client `register()` initialized above. Without this,
// only errors our own catch blocks report would ever reach Sentry — this
// catches the ones that slip past them.
export const onRequestError = captureRequestError;
