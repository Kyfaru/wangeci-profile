# Phase 0: Stabilise and close the open doors

Branch: `phase/0-stabilise` (from `master` at 3a0d961).

## What was built
- Security: `/api/books/[slug]` returns metadata only; `/api/reader/chapter` returns 404; preview returns only `isFreePreview` chapters; dashboard/reader/bookmarks/notifications/library/progress require a real Better Auth session; the reader also requires an Entitlement; fake auth (`mock-auth`, `mock-user`, three auth routes, `/api/cart/add`, session hook) deleted; `lib/server/session.ts` added.
- Config: `trustedOrigins` from env; env checked at boot in production; `.env.example` rewritten; `lib/rate-limit.ts`; Africa's Talking webhook needs `?token=`; security headers (HSTS, nosniff, referrer, frame, permissions) in `next.config.ts`; CSP report-only with nonce in `proxy.ts`; staging noindex.
- Public hygiene: `lib/site.ts` (author name "Wangeci Kariuki"); hero typo fixed; real H1; fake rating, read-time and summary sections removed; invented testimonials and books removed; placeholder phone/email/socials hidden in production; alt text; page titles, descriptions, canonicals; cart noindex; branded 404 and error pages; unbuilt nav links hidden; images renamed.
- Workflow: GitHub Actions CI, Dependabot, vitest, `typecheck`/`test`/`check` scripts, ESLint ignores `.claude/**`.

## Concepts
- **Defence in depth** (a building with a front door guard and a locked room): the proxy checks a cookie exists, each page re-checks the real session.
- **Idempotent / rate limiting** (a turnstile counting entries): `rateLimit(key, limit, window)` caps how often one key can act.
- **CSP report-only** (a rulebook that only writes warnings): lists allowed sources and logs breaches without blocking until we trust it.

## Mistakes avoided
Deleting the mock auth would have broken the dashboard layout, sidebar and six routes; they were rewired first. A forged `wangeci_session` or `better-auth.session_token` cookie now gets a redirect, not data. Build with no secrets still works.

## Tested
`tsc`, `eslint`, `vitest` (2 tests), `prisma validate`, `pnpm build` pass. In Chrome on `localhost:3000`: titles/H1/canonical/noindex, no `#` or dead nav links, security headers present, book API has no chapters, reader API 404, protected APIs 401, forged cookies redirect, AT webhook 401 without token, book page has no rating/summary text, 404 page branded. The one console "hydration" warning comes from a browser extension, not the app.

## Check yourself
1. Open `/`, `/store/from-pieces-to-power`, `/cart`, `/nope`. 2. `curl -I /` and look for the headers. 3. Open `/dashboard/books` signed out: you land on "Sign-in opens soon".

## Unverified / still open
DB is a dummy, so nothing touching Postgres ran. Social-media photos need client clearance. `TODO(client)`: phone, email, place, social links, testimonials, real synopsis, prices. CSP not enforced yet. Branch protection must be set on GitHub (`master`) by you.

## Next: Phase 1 (database and identity)
