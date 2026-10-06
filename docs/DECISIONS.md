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

## Phase 3
- **Paystack signing**: the secret key signs webhooks (verified in their docs), so PAYSTACK_WEBHOOK_SECRET was removed. There is no charge.failed event, so failures come from the verify call and the cron sweep.
- **One path for all payment news**: webhook, status fallback and cron all call applyProviderEvent (lib/orders/apply-event.ts). Access is granted only inside one transaction with a conditional status update, never from the browser or the success page.
- **Late money still counts**: an order that was FAILED or EXPIRED can still become PAID if the provider confirms payment; REFUNDED and PAID never go backwards.
- **M-Pesa trust**: callbacks are unsigned, so the URL holds a secret and a paid callback is confirmed with the STK query API before granting. UNVERIFIED against official Daraja docs (could not be fetched): confirm in sandbox.
- **Refund actor**: refund.completed is written to audit_log in the same transaction as the access removal; the actor is the admin who requested it, else the owner.
- **Provider reference**: Paystack uses our generated reference (saved before the provider call, so the webhook can always find the order); M-Pesa uses the CheckoutRequestID returned by Safaricom.
- **Cart**: books are quantity one; the browser cart is a shopping list reconciled with server prices; mergeCart saves it to the account at sign-in.
- **Dead code removed**: password-reset and verify-link email templates (accounts are passwordless).
- **Cron**: daily on Vercel (plan limit); production should schedule it more often in Coolify (every 5 minutes is fine).

## Phase 4
- **Reader**: CSS columns inside a fixed-size viewport, measured in the browser (client-only render). Saved position = "chapter:word" so any device resumes at the same place; total page count is an estimate from words per page.
- **Server computes progress**: the browser sends only chapter and word (or seconds); the percentage is derived from chapter lengths on the server. Entitlement is checked on every save, bookmark, audio link and chapter page.
- **Audio**: signed links live chapter length + 5 minutes (10 min minimum, 3 h maximum) and are renewed at 80 percent of their life by the same <audio> element; every renewal re-checks the purchase. One element in the dashboard layout, a mini player elsewhere.
- **Read-along**: word timing is estimated (word length + punctuation pauses) because no aligned timing file exists; exact timings can replace lib/audio/word-timing.ts later. Spoken words turn black, future words stay faint.
- **Listening page layout** follows the reader frame, with a music-style player bar in place of "Page X of Y" (your request).
- **Dev audio**: bucket "local" assets are served from /public only outside production; /public/dev-audio is git-ignored (it holds your Dedication.mp3).
- **Settings 2FA** uses the Better Auth twoFactor plugin in passwordless mode with QR and backup codes; admin enforcement comes in Phase 5.

## Phase 5
- **Two-step is tracked per session** (session.twoFactorVerifiedAt). Better Auth only enforces it for password sign-ins, so email-code, phone-code and Google sign-ins would have skipped it. A locked session counts as signed out until the authenticator code is entered. Setting up two-step re-issues the same person session, so it is a renewal, not a second device.
- **Admin gate** = role (lib/permissions.ts) + two-step on + session under 8 hours. Anything else is a 404 for people who may not be there. No 30 minute idle timeout (Better Auth does not track idle time).
- **Writes and audit in one transaction** (lib/admin/actions.ts). Typed reason of at least 10 characters for refunds, complimentary access, bans, role changes and retiring an edition.
- **Refund never sets REFUNDED itself** for cards; M-Pesa uses an owner-recorded manual refund with a reference.
- **Stats cache** in the shared key-value store, 30 to 300 seconds by range length. Revenue counts only PAID orders; refunded orders and complimentary access are excluded.
- **Editions upload page is replaced by scripts/publish-edition.ts** (agreed cut); /admin/content publishes and retires only.
- **Local DB pinned**: .env.development.local overrides the database URLs so development and tests never touch a shared database when .env.local points at Neon.

## Phase 6
- **A guest never gets a session at checkout.** A new account claims exactly one session after the server confirms payment, with a hashed one-time secret only the paying browser holds (Better Auth plugin endpoint `/checkout/claim`). An existing account is never signed in this way.
- **Unverified accounts are allowed to use the dashboard.** Verification happens at the first code sign-in. A stranger who types someone's phone at checkout can only attach purchases to a new unverified account; a phone owned by another account is refused.
- **Retry ladder** 5 tries then 5/5/10/20/40/60 minutes then 24 hours, per email and per IP, in the shared key-value store.
- **Coupon use** is counted when the order is PAID (`timesRedeemed`), plus orders waiting in the last 30 minutes, so a code cannot be used past its limit in parallel by much.
- **Receipt and invoice are one PDF** attached to the success email and downloadable from the thank-you page (owner or paying device only).
- **Orphan accounts**: a guest who never pays leaves an unverified account with no purchases. A cleanup of those is not built yet.
