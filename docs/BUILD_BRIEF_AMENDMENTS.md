# Build brief amendments (rev 2, 2026-10-06)

These amendments OVERRIDE `docs/BUILD_BRIEF.md` wherever they disagree. Source: the review of the brief against the repo and the Figma file `ZhDSoJk2pmyzQ2AsOYAM1m`, plus Jeff's decisions. Read with `docs/reality-report.md`.

## 1. Corrected facts
16 tables; HEAD `3a0d961` on `master`; dashboard/reader pages exist under `/dashboard/*` (mock-backed); one URL scheme: keep `/dashboard`, `/dashboard/books`, `/dashboard/books/[slug]/read`, add `/dashboard/books/[slug]/listen`, `/dashboard/bookmarks`, `/dashboard/activity`, `/dashboard/notifications`, `/dashboard/settings`, `/sign-in`, `/sign-up`, `/verify`. Protect `/dashboard`, `/checkout`, `/admin` in `proxy.ts`. Branch protection applies to `master` (or rename to `main` first).

## 2. Scope decisions
- Digital only at launch. Remove shipping/"Collector's Edition" badges. PAPERBACK enum stays unused.
- Author name: "Wangeci Kariuki" in one `SITE` config. "Wangechi" is a typo to fix.
- Placeholder card stats from Figma (4.2, 21.5k, 75.1k, 1.4k) allowed in development only. A build/launch check must fail if they render in production.
- Figma book blurb and quote describe other content: replace with client copy, mark `TODO(client)`.
- Audio is uploaded by Jeff/Wangeci (192-320 kbps CBR mp3/m4a, one recording per chapter, character voices baked in). Phase 9 (ElevenLabs, BullMQ, Redis worker, FFmpeg, `audio_job`) is deleted. Remove `ELEVENLABS_API_KEY` from `env.ts` and `.env.example`. Transcript sync is cut. Audiobook ships only when files exist, else "Audiobook coming soon".

## 3. Authentication (replaces brief Phase 1 auth text)
- Passwordless: `emailAndPassword.enabled = false`; delete password-reset code and email template. Sign-in has ONE identifier input (Email/Phone tab) and no password field. Methods: email OTP, phone OTP, Google. Facebook replaces the Apple button and is post-launch (needs a Meta app; handle missing email). Hide the button until then.
- Sign-up (Figma): first name, last name, email, phone. BOTH email and phone are verified with 4-digit codes. Design the missing screens (phone verify, 2FA modal, resend cooldown, lockout, "already signed in") before building.
- Code lifecycle: 4 digits (one constant), 5 min expiry, hashed with a pepper, single use, constant-time compare, identical answers for known/unknown identifiers, Turnstile on send.
- Lockout ladder (confirm with Jeff): per identifier, 5 wrong attempts -> 5 min cooldown, repeated 5 times (25 attempts) -> 2 hour cooldown; repeated for a second round -> 2 hour cooldown; then one more 5 min round -> 5 hour lock. Counters in Upstash Redis; success resets. Also limit sends per IP. Show the unlock time; keep Google as fallback; never lock out the owner's admin recovery path.
- SMS cost guard: Kenya (+254) only for SMS by default, other countries email-only until approved; daily spend cap with Sentry alert.
- OTP delivery through QStash (signed `Upstash-Signature` checked on the raw body, `force-dynamic`), env: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, plus Upstash Redis for rate limits.
- One active session per account, enforced on the SERVER: check before sending a code, in `databaseHooks.session.create.before` (race backstop, use an advisory lock or partial unique index), and in the Google callback. Blocked users verify by code, then "sign out other device and continue"; the old session is revoked and the user is notified. Owner/admin keep a TOTP break-glass path.
- Device identity: signed httpOnly `__Host-` `device_id` cookie (random, no fingerprinting), `UserDevice` table, `session.deviceId`. Client cache: AES-GCM encrypted display-only profile (name, masked contact, avatar) split into shards across localStorage and sessionStorage under random key names, manifest separate, `BroadcastChannel` sign-out sync, cleared on sign-out/401. It never holds the session token, OTPs, orders or entitlements. It is a device hint, never a security control.
- "Active users" come from the server only: valid sessions, `user.lastSeenAt` (touch at most every 5 min), `reading_position.updatedAt`.
- Session/cookie hardening: Secure, httpOnly, SameSite=Lax, cookie prefix; rotate token on login and role/2FA change; readers 30 days absolute (consider 14), 7 day idle; admin 8 h absolute, 30 min idle; `cookieCache` off for admin and for ban/lock checks; strict Origin check; `trustedOrigins`/`baseURL` from env; relative-only `redirect`; fresh code for email/phone change, delete, refund, grant, ban, role change; admin TOTP + backup codes; impersonation off.
- Schema additions: `user.phoneNumber`, `phoneNumberVerified`, `twoFactorEnabled`, `twoFactor` table, `ActivityEvent`, `UserDevice`, `session.deviceId`, plus everything already in brief Phase 1. Add `adminClient` to `auth-client.ts`.
- Events logged to `ActivityEvent`: login ok/fail, OTP sent, lock stage, device replaced, session revoked, 2FA change, contact change. Cover device id, `wangeci_vid` cookie and ActivityEvent retention (suggest 12 months) in the privacy page and `anonymiseUser`.

## 4. Reader and listening (replaces brief Phase 4 reader text)
- Reader shows chapter text like Figma. No epub.js, no whole-EPUB signed URL. Server returns ONE chapter after session + Entitlement check (`Cache-Control: no-store`, per-chapter rate limit). The Chapter table stores the body (text column or R2 text asset). Free preview serves only `isFreePreview` chapters. State in the terms that copying cannot be fully prevented.
- The client paginates a chapter by measuring the container (height, width, font), so page counts differ per device. `ReadingPosition.locator` = `chapterIdx:wordOffset`; `progressPct` = words read / total words; "Page X of Y" is computed on the client and never stored.
- Player: single play/pause toggle driven by real `play`/`pause`/`ended`/`waiting`/`error` events; seek bar with elapsed/remaining and buffered range, keyboard arrows +-5 s; back 10 s / forward 10 s (clamped); speed; previous/next chapter; Media Session API. Needs Range support (R2 does) and CBR files with `faststart`; the publish script warns on VBR or late moov atom. Signed-URL refresh at ~80% of TTL keeps `currentTime` and play state. Progress saved as `chapterIdx:seconds` every 30 s, on pause and on tab close.

## 5. Payments (replaces brief Phase 3 provider text)
- Paystack (cards) AND direct Daraja M-Pesa STK push at launch behind `PaymentProvider`.
- Schema: `Order.paystackReference` -> `provider` + `providerReference` (unique together) and Daraja fields (`CheckoutRequestID`, `MerchantRequestID`, receipt number, phone).
- Daraja callback is unsigned: secret in the path, Cloudflare IP allowlist, accept only known `CheckoutRequestID` in PENDING, compare whole-KES amount, then confirm with the STK Push Query API before granting access. STK initiation goes through QStash (do not block the request). Map result codes (cancelled, wrong PIN, 1037, insufficient funds) to FAILED. Sweep stuck PENDING orders by querying Daraja before EXPIRED.
- Refunds: Paystack refund API for cards; M-Pesa refunds are a Daraja reversal or manual return, so the owner Refund button needs a "manual refund recorded" path with reason and audit row. Only a signed/verified event marks REFUNDED for automated paths.
- Lessons from the Fechi project: never commit credentials, token cache key includes base URL + credentials, trim secrets, one callback-base-URL env var, UAT never delivers callbacks.
- Verify Paystack signing key and all Daraja details against current official docs before coding.

## 6. Phase 0 additions
Baseline migration for the existing database (`migrate diff` + `migrate resolve --applied`); move env fail-fast to runtime (`instrumentation.ts`) and make unused vendor keys optional; rewire-then-delete mock modules; Africa's Talking shared-secret token now (IP allowlist later); add `typecheck` and `test` scripts; CI on pnpm 11.16; clean up the seven `worktree-agent-*` branches; fix `images.remotePatterns`; read `node_modules/next/dist/docs/` before writing Next code (AGENTS.md).

## 7. Cut line (19 days: 6 Oct to 25 Oct)
Cut before starting: audiobook (coming soon unless files are ready), admin editions upload page (use `scripts/publish-edition.ts`), Activity and Notifications pages (keep the bell), Facebook login, Customers/Bans admin screens. Post-launch: Phases 7, 8 (blog, Sanity, comments), 10. Never cut: real auth, server entitlement check, webhook hardening, refund path, audit log, admin 2FA, legal pages, backups, go-live smoke test.

## 8. Tests to leave behind
OTP ladder state machine; concurrent verifies (single session); Google callback respects the block; forged/removed device cookie; storage tampering changes nothing server-side; revocation latency with cookieCache off; redirect validator; Origin check; SMS country gate; webhook signature/amount/idempotency/refund; Daraja callback with unknown or replayed `CheckoutRequestID`; entitlement gate; player toggle state and +-10 s clamping.

## 9. Answers from Jeff (2026-10-06)
1. OTP lockout ladder in section 3: confirmed as written.
2. Paystack has NO separate webhook secret, only the secret key. Remove `PAYSTACK_WEBHOOK_SECRET` from `env.ts`/`.env.example` and verify the webhook HMAC-SHA512 with `PAYSTACK_SECRET_KEY` (still confirm against current Paystack docs).
3. Email and SMS codes are both allowed for every reader. The Kenya-only SMS default in section 3 is dropped; keep the daily SMS spend cap, a per-country rate limit and an easily editable country blocklist as the toll-fraud guard.
4. Use the existing design tokens (`--navy`, `--gold`, `--cream`, `--green`, `font-display`, `font-body`); build the missing auth screens code-first, no new Figma frames.
5. `master` is production. Branch protection, CI and PRs target `master`; the local-only `main` branch is ignored (delete it).

## 10. Auth page colours (Jeff, 2026-10-06)
Auth pages (`/sign-in`, `/sign-up`, `/verify`, 2FA, lockout) must reuse the existing blue gradient, not a new blue. It is the Sidebar's `bg-[linear-gradient(170deg,var(--navy)_3%,var(--blue)_143%)]` (`components/dashboard/Sidebar.tsx:65`), built from `--navy #0c2142` and `--blue #0f4fb1` in `app/globals.css`. Put it in one shared utility/class (for example `.bg-brand-gradient` in `globals.css`) and use it from the Sidebar, the auth hero panel and any other blue panel, so there is a single definition. No new hex values; check the home-page navy sections use the same tokens.
