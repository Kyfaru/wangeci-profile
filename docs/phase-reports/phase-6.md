# Phase 6: Guest checkout, coupons, invoices

Branch: `phase/6-guest-checkout` (from `phase/5-admin-core`).

## What was built
- **Checkout for guests** (`/checkout`, no sign-in needed). Section 1: first name, last name, email, phone (a signed-in reader sees their details instead). Section 2: Card (Paystack popup) or M-Pesa. A live summary shows subtotal, discount, fees, coupon box and total. Every number comes from the server (`lib/checkout/quote.ts`, `POST /api/checkout/quote`); the browser only sends edition ids, a coupon code and the buyer's own details.
- **Account made from the details** (`lib/checkout/guest.ts`). New email: an unverified account is created. Existing email: the purchase attaches to that account and nothing about it changes. A phone number that belongs to another account is refused with a clear message.
- **Session after paying, only for a NEW account.** The order stores a hashed secret that only the paying browser holds. After the payment is confirmed by the server, that browser calls a Better Auth plugin endpoint (`POST /api/auth/checkout/claim`) that signs it in, once. Existing accounts are never signed in this way (typing someone's email must not open their account): they get the book and sign in with a code.
- **Payment modal** (Preline `hs-overlay` + `HSOverlay` script): "Enter your M-Pesa PIN" while waiting, a success face, and a failure face with a reason under 10 words (`lib/checkout/reasons.ts`) and a Try again button that unlocks after 15 s with a visible countdown; clicking early shows "A current transaction is underway, please wait." Card: the Paystack popup (`resumeTransaction(access_code)`), and the modal only turns to success after the SERVER says PAID.
- **Retry ladder** (`lib/checkout/attempt-ladder.ts`): 5 attempts, then locks of 5, 5, 10, 20, 40, 60 minutes, then 24 hours with a "contact support" message. Counted per email AND per network address; a successful payment clears the email counter.
- **Coupons**: percent or fixed, minimum subtotal, max uses (paid uses + orders waiting in the last 30 minutes), start/end, on/off. A 100% coupon makes a free order that is granted through the same single-writer function. Owner-only `/admin/coupons` (typed reason, audit row in the same transaction).
- **Success page** (`/checkout/success`): confetti pouring over the message (`canvas-confetti`, off for reduced motion), "your book is in your account", Go to dashboard (already signed in for new accounts), how to sign in next time (email or phone), invoice download.
- **After PAID** (`lib/orders/post-paid.ts`, run once): sequential invoice number `INV-2026-000123` (database sequence inside the payment transaction), invoice/receipt PDF (`pdf-lib`), email with the PDF attached and sign-in instructions, an SMS of 150 characters or fewer, in-app notice, admin alert, cart cleared.
- **Navbar**: user icon (Iconify `lucide:user`) at the far right of every public page, linking to sign-in (signed-in people are sent on to the dashboard).
- **Admin**: order page shows subtotal, discount (coupon), fees, total, invoice number, buyer phone and "account created at checkout"; customers list and detail show "active" and "created at checkout".

## Decisions and findings
- `/checkout` left the proxy's protected list and `requireUser()` no longer demands verified email AND phone: accounts made at checkout start unverified (payment proves the buyer; the first code sign-in verifies).
- One document serves as both receipt and invoice ("Invoice / Receipt", payment already made).
- Seller business name, address and PIN on the invoice are `TODO(client)`.
- Fee: `CHECKOUT_FEE_PERCENT` (default 0).

## Tested
- Unit: pricing and coupons, retry ladder (every lock length), failure reasons under 10 words, SMS length.
- Database: guest account creation, no overwrite of an existing account, phone clash, coupon pricing and used-up code, paid order gets invoice number and PDF, email attachment, SMS length, 100% coupon free order.
- Real browser (headless Chrome): guest filled details, applied a 100% coupon, success modal, redirect, confetti, signed in on the dashboard as the new account. Failure modal: countdown, early-click warning, enabled retry that calls the API again. Claim endpoint: refused for an existing account, a wrong token, and a replay.
- NOT tested for real: the Paystack popup with a live card, and Daraja (unchanged from Phase 3, still unverified).

## Check yourself
1. Add a book to the cart, open Checkout while signed out, fill the form, pay with a Paystack test card.
2. After the success page, open the dashboard: you should already be signed in.
3. Sign out, use the user icon, sign in with the checkout email and the 4-digit code.
