# Reality report (2026-10-06)

Compares `docs/BUILD_BRIEF.md` section 2 with the repository at HEAD `3a0d961` on branch `master`. Read-only review, no code changed. Items marked (unverified) were not checked against current vendor docs.

## 1. Installed versions
Next 16.3.1 (Turbopack), React 19.2.8, Prisma 6.19.3 (`prisma-client-js`), Better Auth 1.7.2, zod 4.4.3, Zustand 5.0.15, React Query 5.102, Sentry 10.71, Resend 6.24, svix 2.1, AWS SDK v3 (S3 + presigner), Tailwind 4, pnpm 11.16, Node >= 20.9 (Dockerfile uses Node 22).
Not installed: vitest, playwright, @upstash/ratelimit, @upstash/redis, @upstash/qstash, Turnstile, epubjs (no longer needed), bullmq (no longer needed).

## 2. What really exists
- Pages: landing, `/store/[slug]`, `/cart`, `/dashboard`, `/dashboard/books`, `/dashboard/books/[slug]/read` (mock data).
- API: auth catch-all, mock `auth/{login,signup,session}`, bookmarks, books/[slug] (+preview), cart/add, health, notifications (+unread-count), reader/chapter, reading/progress, search, user/library, webhooks (paystack, resend, africastalking/delivery).
- Libs: `auth.ts` (email+password only), `auth-client.ts` (emailOTP, phone, twoFactor client plugins), `env.ts` (zod, eager), `email.ts`, `sms.ts`, `r2.ts` (`getSignedDownloadUrl`, `publicUrl`), `prisma.ts`, stores (cart, player, reader), mock modules.
- DB: 16 models (not 17). No `prisma/migrations` folder. Enum `EditionFormat` has PAPERBACK.
- Infra: Dockerfile (standalone, builds with no secrets), Sentry configs, `.env.example`. No CI, no tests, no `docs/`, no Dependabot.
- Git: working branch `master` (remote default is `master`); `main` exists locally only. The brief's "protect `main`" must be reconciled (rename or protect `master`).
- Baseline: `tsc --noEmit` passes clean.

## 3. Mocked / not built
Mocked: books, reader chapter, cart add, search, bookmarks, notifications, library, reading progress, login/signup/session, dashboard user.
Not built: sign-in/sign-up/verify pages, checkout, success, store list, about, services, contact, blog, legal pages, listening page, settings, admin, notifications and activity pages.

## 4. Brief vs repo: confirmed defects
Confirmed in code: full chapter text from `/api/books/[slug]`; no entitlement check on `/api/reader/chapter`; forgeable `wangeci_session` cookie; `trustedOrigins` hard-coded to localhost; unsigned Africa's Talking webhook; Paystack webhook without amount/currency check, failed/refund events or conditional update; no Chapter table; proxy cookie-presence only.
Not confirmable from code: duplicate carts (only browser cart + DB `Cart` model exist; no merge code), live-site 404s, copy typos (not re-run against production).

## 5. Where the brief is wrong
1. 17 tables -> 16. 2. HEAD is `3a0d961`, not `836687e`. 3. Dashboard and reader pages exist (mock-backed) under `/dashboard/*`. 4. `proxy.ts` protects `/my-books` and `/account` which do not exist, leaving `/dashboard/*` open. 5. Eager `env.ts` validation cannot "fail fast" at import because Docker builds without secrets. 6. Deleting mock auth breaks `(dashboard)/layout.tsx`, `Sidebar.tsx`, `lib/dashboard/current-user.ts`, `use-session.ts` and six API routes. 7. Paystack signature secret: code uses `PAYSTACK_WEBHOOK_SECRET`; Paystack signs with the account secret key (unverified).

## 6. Ten risks the brief does not list
1. No baseline migration; the Neon schema may have been created with `db push`.
2. Better Auth `cookieCache` (5 min) delays bans and session revocation.
3. `emailAndPassword` stays enabled and is a second login path.
4. `env.ts` requires `ELEVENLABS_API_KEY` and every other vendor key at boot; staging will not start without them.
5. Better Auth phone and two-factor plugins need columns/tables the schema lacks.
6. `images.remotePatterns` wildcard `*.r2.dev` allows any R2 public domain.
7. Branch name mismatch (`master` vs `main`) breaks branch-protection and CI instructions.
8. No security headers or CSP; the encrypted browser cache is only as safe as XSS prevention.
9. Seven leftover `worktree-agent-*` branches exist locally; clean up before CI/branch work.
10. Africa's Talking SMS has no country gate or spend cap, so OTP pumping can cost real money.

## 7. Open questions
See `docs/BUILD_BRIEF_AMENDMENTS.md` section 9.

## 8. Lint baseline (added after the lint run finished)
- `eslint .` reports 83,869 problems (5,605 errors), almost all because it also scans `.claude/worktrees/agent-*` (leftover agent worktrees inside the repo). Fix: add `.claude/**` to the ESLint ignores and delete the worktrees (risk 9).
- Real errors in the project itself: `emails/verify-email.tsx` and `emails/password-reset-email.tsx` have 2 unescaped apostrophes each (`react/no-unescaped-entities`). `password-reset-email.tsx` is deleted anyway once passwords are removed.
- `public/images` still has social-media-style names and bad names (`DSC09752.jpg 2.png`, `DSC09752.jpg.jpeg`, `DSC09759.jpg.jpeg`, `From Pieces to Power FINAL PRINT.png`), confirming the brief's image-name defect.
- `.gitignore` has no `.env*` entry visible in the first 30 lines (check that `.env.local` is ignored before any commit).
