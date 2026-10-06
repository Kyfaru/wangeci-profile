# Phase 3: Cart, checkout, payments and orders (the money path)

Branch: `phase/3-money-path` (from `phase/2-catalogue-public`).

## What was built
- **Schema** (migration `phase3_payments`): `Order.provider` (PAYSTACK or MPESA), `providerReference` (the old `paystackReference` renamed, data kept), M-Pesa fields, `paidAt`, `failureReason`, `refundRequestedById`. `PAYSTACK_WEBHOOK_SECRET` is gone: Paystack signs with the secret key (confirmed in their docs).
- **PaymentProvider interface** (`lib/payments/types.ts`): `initialize`, `verifyWebhook`, `parseEvent`, `verify`, `refund`. Implementations: Paystack (card), M-Pesa STK push through Daraja. All amounts are shillings in our code; Paystack converts to cents.
- **One grant function**: `grantOrderEntitlements(orderId, tx)` plus `markOrderPaid`, whose status change is a conditional update ("only while PENDING, FAILED or EXPIRED"), so two simultaneous webhooks cannot both win.
- **`applyProviderEvent`**: the single place every payment path ends. Checks amount and currency against the order (mismatch: nothing granted, Sentry message, urgent admin alert, order kept), confirms M-Pesa with Safaricom before trusting an unsigned callback, grants access in one transaction, then sends receipts after the commit (a failing email can never fail the webhook). Handles failed payments, `refund.processed` (marks REFUNDED, removes only the access that order granted, writes `refund.completed` in the same transaction) and `refund.failed`.
- **Checkout**: `GET /api/cart/quote` (display prices), `POST /api/checkout` (zod, rate limited, verified accounts only, edition ids only from the browser, prices from the database, owned editions rejected, snapshots `unitPrice`), `/checkout`, `/checkout/success?ref=` (polls `GET /api/orders/[id]`, owner only; after 15 s the server asks the provider itself and runs the same idempotent grant).
- **Webhooks**: Paystack (signature on the raw body; 401 bad signature, 200 for anything a retry cannot fix, 503 only if the database fails) and `/api/webhooks/mpesa/<secret>` (404 for a wrong secret).
- **Cron** `/api/cron/orders` (Bearer `CRON_SECRET`; `vercel.json` runs it daily on staging, use a Coolify scheduled task in production): reconciles stuck orders, expires orders PENDING over 24 h, purges old contact messages.
- **Notifier** (`lib/server/notifier.ts`): receipts and refunds always send; optional notices respect `UserPreferences`. **Audit helper** `recordAudit`.
- **Cart**: books are quantity one; the cart page reconciles with server prices and drops items no longer for sale; `mergeCart` server action merges the browser cart into the account cart at sign-in (deduplicated).

## Concepts
- **Webhook** (a courier ringing the doorbell): the payment company calls our server to say "this one is paid". Anyone can ring the bell, so we check the courier's signature first.
- **Idempotency** (pressing a lift button twice does nothing new): handling the same payment message twice leaves exactly one set of books.
- **Conditional update** (a seat only goes to the first person to sit): the database changes the order only if it is still unpaid, so a race has one winner.

## Tested
- 21 new automated tests: signature accepted and rejected (wrong key, changed body, missing, garbage, short), repeated webhook, three simultaneous webhooks (one grant), amount and currency mismatch (alert raised, nothing granted), unknown reference, failed charge, late success after failure, no downgrade of PAID, refund removes only that order's access and keeps complimentary access, refund nobody asked for is ignored, failed refund, M-Pesa needs confirmation, wrong-provider event, checkout uses database prices and snapshots them, rejects owned, inactive and paperback editions. 50 tests pass with a local database.
- Real routes on the running app: checkout unauthenticated 401, browser-supplied prices ignored, provider failure leaves a FAILED order and a clear message, M-Pesa hidden when not configured; signed webhook flow: forged and missing signature 401, wrong amount 200 and nothing granted, correct amount grants once, replay changes nothing, unknown reference 200, wrong M-Pesa path 404; an order is visible only to its owner; cron 401 without the secret and, with it, expires the old order; the status fallback with an unreachable provider keeps PENDING without crashing.
- Browser: sign-in, add to cart, cart then checkout; the stale items from the old fixture were dropped and the price shown was the server price; paying for a book already owned showed "You already own".

## Mistakes avoided
Paystack has no `charge.failed` event (the old TODO assumed one): failures are found with the verify call and the cron sweep. A delayed webhook for an order we already expired still grants the book (the money did arrive). M-Pesa tokens are cached under a key containing the base URL and credentials, so a sandbox token can never be reused in production. `DYNAMIC` build issue: the Redis store is now created lazily.

## Check yourself
1. With real Paystack TEST keys in `.env.local`, buy the book with a Paystack test card and confirm it lands in My Books.
2. Tunnel the app (for example Cloudflare Tunnel) and set the Paystack test webhook URL to `<tunnel>/api/webhooks/paystack`.
3. For M-Pesa, set the `DARAJA_*` values for the sandbox and try the STK push (see the warning below).

## Not verified, honestly
- **Paystack** requests were never run against Paystack (dummy key). Initialize, verify and refund request shapes follow their current docs. The field that carries the original transaction in `refund.*` payloads is not documented anywhere I could read, so `parseEvent` accepts three likely names and only acts on orders we asked to refund.
- **M-Pesa/Daraja**: official Safaricom docs could not be fetched. The request and callback shapes come from common integrations and MUST be confirmed in the Daraja sandbox, then with one real KES 1 payment before launch.
- Refund REQUEST (the admin button that calls `refund`) arrives in Phase 5; the completion path is done and tested here.
- The reader's "buy" button on a book you own still shows "Buy" (the library work in Phase 4 turns it into "Read").
- `vercel.json` cron is daily (Vercel's free plan limit); the 15 second status fallback covers the gap.

## Questions for you
- Paybill or Till for M-Pesa (`DARAJA_TRANSACTION_TYPE`)? Which shortcode and passkey?
- Is KES the only currency?

## Next: Phase 4 (library, reader and listening)
