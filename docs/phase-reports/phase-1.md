# Phase 1: Database foundation and real identity

Branch: `phase/1-database-identity` (from `phase/0-stabilise`).

## What was built
- **Database**: baseline migration plus `phase1_identity_content` (Chapter, Bookmark, TwoFactor, UserDevice, ActivityEvent, Comment, Feedback, AuditLog; user role, ban, phone, 2FA and lastSeenAt; session impersonatedBy and deviceId; Edition title, narrator and duration; OrderStatus EXPIRED; Order.refundRequestedAt; NotificationLog in-app fields and a unique (userId, dedupeKey)). `prisma/seed.ts` (fake data, refuses production). Local Postgres script `scripts/dev-db.mjs`.
- **Auth server** (`lib/auth.ts`): passwordless; emailOTP, phoneNumber, twoFactor (passwordless allowed), admin (owner only, impersonation blocked), Turnstile, Google (when keys exist); OTP lockout ladder; one session per account with verify-then-replace; the first owner is created only through `ADMIN_EMAIL_ALLOWLIST`.
- **Server helpers**: `getSession`, `requireUser`, `requireRole`, `can()`, `anonymiseUser`, `logActivity`, `safeRedirect`, a `lastSeenAt` touch (at most every 5 minutes).
- **Pages** (Figma layout, existing tokens, one shared `bg-brand-gradient`): `/sign-in` (Email/Phone tabs, Google when enabled), `/sign-up`, `/verify` (code boxes, resend cooldown, phone step, "already signed in" screen, 2FA modal). Sign-out in the sidebar. Encrypted, split browser cache and a zustand store without `persist`.
- `proxy.ts` sets the device cookie and protects `/dashboard`, `/checkout`, `/account` and `/admin`.

## Concepts
- **Session** (a wristband at an event): the server hands one out after you prove who you are and checks it on every visit. Here there is one wristband per person.
- **One-time code and lockout ladder** (a safe that locks for longer after each wrong guess): wrong guesses earn 5 minute, 2 hour and finally 5 hour waits.
- **Migration** (a numbered recipe for changing the database): each file changes the schema one step; the baseline is the starting point.

## Tested (real, against a local Postgres)
- Unit: ladder, redirect validator, `can()`, secure cache (29 tests). With `TEST_DATABASE_URL`: session policy and `anonymiseUser` (3 more).
- API: code request without a Turnstile token 400; wrong codes 400; 5 wrong codes then a lock 429 (new codes blocked too); correct code signs in with an httpOnly cookie; the allowlisted email became owner; a second device got SESSION_ALREADY_ACTIVE, signed in after consent, and the first device then got 401; untrusted origin 403; password login 400; impersonation 403; QStash route without a signature 401; Africa's Talking webhook with a wrong token 401.
- Browser: sign-up with an email code then a phone code created the account and landed on My Books; sign-out cleared the session and the cache; localStorage held no plain-text name. Screenshots of sign-in (desktop) and sign-up (mobile) checked.
- `tsc`, `eslint`, `vitest` and `pnpm build` pass.

## Mistakes avoided
The phone prefill first split "+254712..." into the wrong dial code (found while testing; now the dial code and number are saved separately). `next build` imported Redis code with no secrets (made lazy). Better Auth's admin plugin refused to start without role definitions (added). The captcha plugin was spread conditionally, which erased Better Auth's types (now always listed).

## Check yourself
1. `pnpm db:dev`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`.
2. Open `/sign-up` and fill the form. The code is printed in the terminal as `[dev] one-time code ...` (real email and SMS need valid Resend and Africa's Talking keys).
3. Sign in on a second browser: you should see "Already signed in" and the button to sign the first one out.

## Unverified or not done
- Google sign-in (no OAuth client yet), real Resend and Africa's Talking delivery, a real QStash queue, Turnstile with real keys (test keys used), TOTP enrolment (Phase 5), the Facebook button.
- Google users who hit the one-session rule cannot yet use "sign out the other device" (they must use a code).
- The baseline migration has not been applied to Neon (needs `migrate resolve` and your approval).
- Phone-first accounts are not allowed; every account starts with an email.

## Questions for you
- OK to move codes from 4 to 6 digits? With these limits a 4-digit code is still about a 1% a day guess chance for a determined attacker.
- Which sending domain will the client verify with Resend?

## Next: Phase 2 (catalogue, chapters, store and public pages)
