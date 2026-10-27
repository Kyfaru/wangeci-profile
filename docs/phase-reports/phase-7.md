# Phase 7: Launch hardening (what could be done without your accounts)

Branch: `phase/7-launch-hardening` (from `phase/6-guest-checkout`).

## What was built
- `docs/GO_LIVE.md`: the full checklist (services, webhooks, migrations, scheduled job, CSP flip, Cloudflare, backups, rehearsal, open client questions).
- Cron now also deletes checkout accounts nobody paid for, signed in to or verified after 7 days (`lib/checkout/abandoned.ts`, with a database test). An account that ever started a payment is kept, because its order is a record.
- CSP (still report-only) now allows the Paystack card popup, so it will not break when switched to enforcing.

## Not done on purpose (needs you)
- Flipping the CSP to enforcing: needs a staging pass with the console open (list in GO_LIVE).
- Africa's Talking IP allowlist: needs their published IPs; the shared token already protects the webhook.
- Real deploys, Daraja and Paystack live tests, backups, Cloudflare rules, Lighthouse: these touch your accounts or live money.

## Tested
tsc, eslint, all tests with the local database, `pnpm build`.
