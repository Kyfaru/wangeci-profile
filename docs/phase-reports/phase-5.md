# Phase 5: Admin core

Branch: `phase/5-admin-core` (from `phase/4-library-reader-listening`).

## What was built
- **The admin gate** (`checkAdmin` / `requireRole` in `lib/server/session.ts`): a real session; the role may do the action (`lib/permissions.ts` is the only place that decides); two-step (authenticator app) is switched on; the session is under 8 hours old. Anyone not allowed gets a 404 (the page is not revealed), an admin without two-step is sent to set it up, an expired session goes to sign-in. Impersonation stays blocked.
- **Two-step is now real for everyone who turns it on.** Finding: Better Auth only asks for the authenticator code on password sign-ins, so signing in with an emailed code, a text code or Google skipped it completely. New column `session.twoFactorVerifiedAt`: sessions of accounts with two-step start locked; `getSession()` treats a locked session as signed out; `/verify?step=2fa` takes the code; a correct code (or backup code) unlocks that session. Setting up two-step re-issues your own session (not a second device).
- **Admin area** (`/admin`, same look and the one shared brand gradient, drawer on phones): Overview (revenue and paid orders with refunded orders and complimentary access excluded, accounts with a valid session, active readers, books bought per edition, reading progress per book, latest orders, "needs attention", simple bars), `TimeRange` object (server clock, presets, custom range capped at 24 months, chart unit and cache time follow the length, Nairobi midnight for "today"), Sales (per edition table, filterable orders with server-side paging, order detail with refund and history), Customers (search, detail with orders, owned books, progress), Inbox (bell items, plain text only), Content (publish or retire), Roles (owner only), Audit log (owner only, read only).
- **Refunds**: owner-only server action. Guards (PAID, not already requested, card only) then `refund.requested` and a pending flag in one transaction, then the provider is asked; it NEVER sets REFUNDED itself (only the signed provider event does, in Phase 3). If the provider refuses, the flag is cleared and `refund.failed` is written. M-Pesa is paid back by a person and recorded with a reference, which removes access and writes `refund.completed`.
- **Other owner actions**: complimentary access (an entitlement with no order, never counts as revenue; revocable only while complimentary), ban and unban (ends all sessions), role changes (not to owner, not for owners or yourself, ends sessions), publish or retire an edition. Every one needs a typed reason of at least 10 characters and writes its `audit_log` row in the SAME transaction as the change. Viewing a customer's progress is itself logged.
- Reusable `DataTable` with server-side paging, `ActionForm`, `TimeRangeControl`, lint rule that keeps admin-only modules out of non-admin folders.

## Concepts
- **Defence in depth**: the layout gate, every page and every server action each check again; a hidden button is never the security.
- **Audit log** (a ship's logbook): rows are only ever added by admin actions, in the same breath as the change.
- **Two-step on the session** (a stamp on your wristband): having the right email code gets you a wristband, but accounts with two-step are not let in until it carries the authenticator stamp.

## Tested
- 93 automated tests with a local database (including `can()` for every role and action, the gate for every role with and without two-step, expired and banned sessions, a session still owing the code, time range rules, every admin write including the refund provider refusing, two refund clicks at once, and paid access that cannot be revoked).
- Real run on the dev server: owner without two-step is sent to settings; two-step set up with a real generated authenticator code; after a fresh email-code sign-in the admin stays locked (307 to `/verify?step=2fa`) until the code is entered; then all admin pages open. By URL: support opens Overview, Sales, Customers, Inbox and gets 404 on Content, Roles, Audit; editor opens only the admin shell and gets 404 everywhere else; a reader gets 404 on all. Refund form in a real browser: provider (dummy key) refused, order unchanged, audit rows `refund.requested` and `refund.failed`.
- `tsc`, `eslint`, tests, `pnpm build` pass.

## Mistakes avoided
Two-step bypass through code and Google sign-in (found by testing the real flow, not by reading docs). Confirming two-step set-up first threw a 403 and left a half-finished state because the one-device rule blocked the session re-issue; it is now treated as a renewal. An audit row cannot be missing for a change: both are one transaction.

## Check yourself
1. Sign in as the owner (`ADMIN_EMAIL_ALLOWLIST`), open Settings, set up two-step with your phone, then open `/admin`.
2. Sign out and in again: you should be asked for the authenticator code before the admin opens.
3. Open an order, try Refund (it will say the provider refused until real Paystack keys are in place) and look at `/admin/audit`.

## IMPORTANT: `.env.local` now points at Neon
During this phase `.env.local` was changed (10:04) to a Neon database. That Neon database has NO tables yet (I confirmed `public.two_factor` is missing) and I did NOT migrate it. To protect it, I added `.env.development.local` (git-ignored) that keeps `pnpm dev`, the seed script and all my tests on the local throwaway Postgres. When you want Neon used for real: run `prisma migrate resolve --applied 20261006000000_baseline` only if it was created earlier by another route, otherwise `prisma migrate deploy` (all migrations) with `DATABASE_URL` and `DIRECT_URL` set; tell me and I will do it with you.

## Not done or unverified
- Customers screen "ban" and role forms are built and tested at function level; I did not click them in a browser. Editions upload page is replaced by the publish script (agreed cut).
- Admin idle timeout (30 minutes) is not enforced, only the 8 hour limit.
- The Overview cache means numbers can be up to 5 minutes old for long ranges (by design).
- Real Paystack refund (needs live or test keys).

## Questions for you
- Do you want Neon used from now on for development, or keep local as the default (current setup)?

## Next: the guest checkout and receipts phase you asked for, then launch hardening
