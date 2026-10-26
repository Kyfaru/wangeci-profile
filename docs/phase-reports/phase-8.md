# Phase 8: traced errors, security fixes, remaining features

Branch: `phase/8-trace-errors` (from `master`).

## What was built
- **One traced error path** (`lib/trace.ts`): `AppError(code, message, status)`, `api(name, handler)` on every route, `traced()` for background steps, `logError`. One JSON log line per failure with a request id (validated, correlated through AsyncLocalStorage), PII scrubbed, Sentry for unexpected errors, no stack to the browser. Returned 4xx bodies get the request id too. The error page and the payment failure modal show "Reference: <id>".
- **Disputes and refund states** (Paystack dispute events flag the order and alert the owner; access is never auto-revoked). A refund request is cleared only on a definite refusal, never on a timeout.
- **Strict by default**: `isRelaxed()` in `lib/site.ts` is the single switch; only an explicit `NEXT_PUBLIC_SITE_ENV=staging` relaxes checks. Live Paystack/Daraja keys required in strict mode.
- **Features from the design pack**: comments + moderation, feedback inbox, admin settings, new-admin-device email, verify-later banner, Umami cards, Chatwoot webhook, Sanity blog (all behind env flags).
- **Security audit fixes** (23 findings): guest phone no longer becomes a sign-in factor, SMS sending needs an existing account + country allowlist + daily alert, trusted-hop client IP, PII masked for token holders, claim token in a header and burned after use, step-up email code for 2FA changes and for refunds/role changes, TOTP failure ladder, replace-consent bound to a one-time token, coupon race closed with a transaction lock, per-buyer coupon limit, STK prompt limits, whole-shilling totals, M-Pesa reference never lost, duplicate-payment alert, receipt re-send sweep.
- **Less code**: toast system, API client, unused routes, support bridge, query client and 3 dependencies removed; six error classes merged into `AppError`; one notification bell; one `clientIp`, `limit`, `safeEqual`.
- **Tests**: 160 unit/DB tests and 20 Playwright tests (`e2e/app.spec.ts`: guest checkout, existing account not signed in, phone clash, coupons, failure modal, retry ladder, error shape, admin gate, comments).

## Not done / needs you
- Umami API shapes unverified against a real site; Daraja shapes unverified until a real KES 1 payment; Paystack dispute/refund webhook payload field has no published sample.
- Playwright was run locally only (not yet in GitHub Actions).
- The design pack (drawio) is not yet updated to match.
- Owner-only list: `docs/GO_LIVE.md`.
