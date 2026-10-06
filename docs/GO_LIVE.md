# Go-live checklist

Staging is Vercel (branch `stage`). Production is a VPS with Coolify (branch `master`). Work top to bottom; tick as you go. Nothing here has been run against staging or production by the build: every step below is yours to do or to approve.

## 1. Before anything is deployed
- [ ] Merge the phase branches in order (`phase/0` ... `phase/7`) into `stage`, one pull request each, and let CI pass (`prisma validate`, typecheck, lint, tests, build).
- [ ] Create the production Postgres database. Run migrations with `pnpm exec prisma migrate deploy` (never `migrate dev`, never `db push`) against it. Order: baseline then every folder in `prisma/migrations`. For an existing Neon database that already has tables, ask first: the baseline must be marked applied (`prisma migrate resolve --applied <baseline>`), not re-run.
- [ ] Set every variable in `.env.example` (see section 2). `lib/env.ts` refuses to start in production without the required ones.
- [ ] `ADMIN_EMAIL_ALLOWLIST` contains only Wangeci's and your emails. The first one to sign in becomes the owner; set up the authenticator app straight away (the admin does not open without it).

## 2. Services and what they need
| Service | What to do |
|---|---|
| Paystack | Live keys. Webhook URL `https://<domain>/api/webhooks/paystack` (signed with the secret key, no separate secret). Turn on the card channel for KES. |
| Daraja (M-Pesa) | Production keys, shortcode, passkey, `DARAJA_ENV=production`. Callback URL is `https://<domain>/api/webhooks/mpesa/<DARAJA_CALLBACK_TOKEN>`. **Daraja request and callback shapes are unverified**: do one real KES 1 payment before launch and one failed one (cancel the prompt). |
| Resend | Verify the sending domain (SPF, DKIM) and replace the placeholder sender in `lib/email.ts`. Add the webhook secret. |
| Africa's Talking | Live username, API key, an approved sender id. Delivery webhook URL needs `?token=<AT_WEBHOOK_TOKEN>`. Once AT publishes its sender IPs, also allow only those at Cloudflare. |
| Upstash | Redis (rate limits and OTP lockouts) and QStash (code delivery). Signing keys in env. Without Redis production would use per-process memory, so it is required. |
| Turnstile | Site key and secret for the production domain. It guards code requests, guest checkout and the contact form. |
| Cloudflare R2 | Bucket, CORS for the site origin, keys (see `docs/R2_SETUP.md`). Publish books with `scripts/publish-edition.ts` (see `docs/PUBLISHING.md`). |
| Sentry | DSN and auth token (source maps). |
| Google sign-in | OAuth client with the production redirect URI, or leave empty and the button hides. |

## 3. Scheduled job
`GET /api/cron/orders` with `Authorization: Bearer <CRON_SECRET>`. Vercel runs it daily (`vercel.json`). In Coolify add a scheduled task every 5 minutes. It: asks the provider about orders stuck in PENDING, expires unpaid orders after 24 hours, deletes old contact-form items, and deletes checkout accounts nobody paid for or verified after 7 days.

## 4. Security switches
- [ ] **Content-Security-Policy**: currently report-only (`proxy.ts`). On staging open every page (home, store, a book, cart, checkout with the card popup and Turnstile, sign-in, a dashboard, reader, listening page, admin) with the browser console open. When no violation is reported, change the header names from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `proxy.ts`. Keep `'strict-dynamic'` and the nonce.
- [ ] `NEXT_PUBLIC_SITE_ENV=production` only on the production host (it removes the staging `noindex`).
- [ ] Cloudflare in front of the VPS: proxy on, "Always HTTPS", a rate-limit rule on `/api/auth/*` and `/api/checkout`, bot fight mode on. Close all ports except 80, 443 and SSH; SSH keys only.
- [ ] No placeholder content: search the site for `TODO(client)` and the dev-only Figma stats; `docs/reality-report.md` lists them. Terms, Privacy, Refunds and Cookies pages are drafts until a lawyer approves them.

## 5. Money-path rehearsal (staging, test keys)
1. Guest checkout with a Paystack test card: success modal, success page, signed in on the dashboard, receipt email with PDF, SMS, invoice download, order and customer visible in the admin.
2. Same with a 100% coupon (free order).
3. Cancel the card popup: failure modal, 15 second retry timer, early click warning.
4. Fail five times in a row: the 5 minute lock appears; the message after the final lock mentions support.
5. Send the Paystack webhook twice: still one entitlement. Send a wrong signature: 401.
6. Refund a card order from the admin; confirm access disappears only after the provider confirms.

## 6. Backups and recovery
- [ ] Postgres: daily automated backups with 14 days retention, and a restore tested once into a scratch database. Take a manual backup immediately before each production migration.
- [ ] R2: versioning on, so an overwritten audio file can be recovered.
- [ ] Keep the previous Coolify deployment so a rollback is one click. Migrations here only add; if one must be undone, restore the backup, do not hand-edit tables.

## 7. After launch
- [ ] Watch Sentry and `/api/health` (point an uptime monitor at it, alert on two failures).
- [ ] Check `/admin` Overview daily for "needs attention" (mismatched amounts, failed refunds).
- [ ] Lighthouse and accessibility pass on the home page, store, checkout and reader.

## Open client questions
Contact inbox email, sending domain, refund window, seller legal name, address and tax PIN (invoice), the real dedication/chapter text for the read-along, whether diaspora readers should get SMS codes, and 4 versus 6 digit codes (6 is safer; 4 is in the design).
