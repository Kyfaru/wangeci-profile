# Decisions log

## Phase 0
- **Fixtures vs lint rule**: banned `mock-*` imports everywhere except a short legacy list (store page, books/search APIs). Why: the catalogue still reads the fixture until Phase 2 builds the real read model; a blanket ban would have blocked the build. Removing the override list is a Phase 2 task.
- **Env validation**: skipped only when `NEXT_PHASE=phase-production-build`; in a running production server `instrumentation.ts` imports `lib/env` at boot. Options: lazy getter (rewrite every import) vs this guard. Chose the guard: one line, and `next build` imports route modules but has no secrets.
- **CSP**: report-only in Phase 0 using a per-request nonce in `proxy.ts`. Enforcing needs all pages to render dynamically (nonces cannot be baked into static HTML), so the flip to enforce is a Phase 6 decision after checking the console for violations.
- **Rate limiter**: Upstash Ratelimit over HTTP (works on Vercel and a VPS) with an in-memory fallback for dev/tests only; production without Redis throws.
- **Dashboard and reader**: now require a real session; the reader also requires an Entitlement row, so with no entitlements it returns 404. Content returns in Phase 4.
- **Deleted, not hidden**: fake auth routes, `/api/cart/add` (trusted browser prices), the invented fixture books, fabricated testimonials. Testimonial section hides itself when the list is empty.
- **Staging safeguards**: `NEXT_PUBLIC_SITE_ENV` other than `production` sends `X-Robots-Tag: noindex` and `noindex` meta. Set it to `production` only on the real domain.
- **Sign-in placeholder**: `/sign-in` is a "coming soon" page so the proxy redirect never 404s; Phase 1 replaces it.
- **Images**: renamed to lowercase-hyphen names; unused originals moved to `design-assets/` (outside the web root). Social-media photos still need written clearance from the client.
- **Test account**: the user supplied an owner email for local testing. The brief is passwordless, so no password is stored or used anywhere.
