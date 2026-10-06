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

## Phase 1
- **Local database**: embedded-postgres (real Postgres, no Docker) via pnpm db:dev, data in .local/pg. Chosen over Docker (not installed), PGlite (needs an adapter) and a shared Neon branch. DB tests run only when TEST_DATABASE_URL is set.
- **Migrations**: baseline (the 16 tables that existed) plus phase1_identity_content. On the existing Neon database run prisma migrate resolve --applied 20261006000000_baseline, then migrate deploy. Never against staging or production without asking.
- **Roles**: user.role text, default reader (not null as the brief said); owner, support, editor, reader. Permissions live only in lib/permissions.ts; Better Auth admin plugin is owner only and impersonation is blocked by a hook.
- **Passwordless**: emailAndPassword disabled; sign-up starts with email, then the phone is verified onto the signed-in account. No signUpOnVerification, so an unknown phone cannot sign in. requireUser sends incomplete accounts to /verify?step=complete.
- **One session per account**: refused with SESSION_ALREADY_ACTIVE unless the person consented; consent is a 10 minute single-use flag keyed by email or phone. Race backstop: after a session is created, older sessions are deleted (newest survives). Google has no consent step yet.
- **Codes**: 4 digits (one constant), 5 minute expiry, hashed, 5 tries per code, then the ladder in lib/auth/otp-ladder.ts (5x5 attempts with 5 minute cooldowns, 2 hour cooldown after 25 and 50, then a 5 hour lock). Counters in Upstash Redis (memory in development). Recommendation: 6 digits.
- **Code delivery**: QStash (signed /api/qstash/send-otp), direct send when no token. Trade-off: the code passes through Upstash for up to 5 minutes.
- **Cookie cache off** so bans and revocations apply immediately.
- **Browser cache**: AES-GCM, split across localStorage and sessionStorage, display data only, never trusted by the server.
- **Device id**: random httpOnly cookie from proxy.ts, stored on session.deviceId and user_device. Not a fingerprint.
- **Turnstile** via the captcha plugin on the two send endpoints; Cloudflare test keys locally.
- **Facebook** not built (needs a Meta app); Apple removed.

## Phase 2
- **Catalogue**: read from the database on demand with a 5 minute cache (revalidate = 300), not at build time, because the build has no database. Digital only: PAPERBACK editions are ignored.
- **Cover source**: Asset kind COVER_IMAGE; bucket "local" means a file in /public (used by the seed), otherwise the public R2 bucket. Fallback is the memoir cover. No new column was added.
- **Contact form**: Turnstile is checked on the server by lib/turnstile.ts (not the auth captcha plugin, which only covers auth endpoints). Honeypot answers 200 and does nothing.
- **SupportBridge** seam in lib/support-bridge.ts; today = admin bell (owner and support) plus an email to CONTACT_INBOX_EMAIL.
- **Legal pages** are drafts with a visible banner, written to mention the Kenya Data Protection Act 2019, processors, and deletion requests; refund window, entity name and retention periods are TODO(client).
- **Publishing** is a script (scripts/publish-edition.ts) until the admin upload page exists; it is inactive-by-default and refuses non-local databases without --yes.
- **Sitemap and robots** exclude private areas; robots blocks everything unless NEXT_PUBLIC_SITE_ENV=production.
