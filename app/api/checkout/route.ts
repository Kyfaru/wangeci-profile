import { NextResponse } from "next/server";
import { z } from "zod";

import { payLadder } from "@/lib/checkout/attempt-ladder";
import { BuyerError, newClaimToken, resolveBuyer, type Buyer } from "@/lib/checkout/guest";
import { limitOrThrow } from "@/lib/checkout/limits";
import { buildQuote } from "@/lib/checkout/quote";
import { env } from "@/lib/env";
import { createPendingOrder } from "@/lib/orders/create";
import { markOrderPaid } from "@/lib/orders/grant";
import { afterOrderPaid } from "@/lib/orders/post-paid";
import { enabledProviders, getProvider } from "@/lib/payments";
import { toMpesaPhone } from "@/lib/payments/mpesa";
import { normalizeKenyanOrE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";
import { AppError, api, traced } from "@/lib/trace";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const name = z.string().trim().min(1).max(60);
// Only edition ids, a coupon code, the chosen method and the buyer's own details come from the browser.
// Prices, totals and currency never do: any "price" field a client sends is dropped by this schema.
const bodySchema = z.object({
  editionIds: z.array(z.string().min(1).max(64)).min(1).max(10),
  method: z.enum(["card", "mpesa"]),
  coupon: z.string().trim().max(40).optional(),
  /** M-Pesa only: a different phone for the prompt. Signed-in buyers only; defaults to the buyer's phone. */
  mpesaPhone: z.string().trim().max(20).optional(),
  buyer: z.object({ firstName: name, lastName: name, email: z.string().trim().toLowerCase().email().max(120), phone: z.string().trim().min(7).max(20) }).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const STK_PROMPTS_PER_PHONE = 3; // a phone can be sent at most 3 payment prompts ...
const STK_WINDOW = "10 m"; // ... per 10 minutes, whoever asks

/**
 * POST /api/checkout: starts a payment for a signed-in buyer OR a guest (who gets an account made for them).
 * Order of checks: shape, rate limit, bot check (guests), prices (nothing is created if the cart is bad),
 * the retry ladder, then the account and the order. A guest NEVER gets a session here: the existing-account
 * case would be an account takeover, and a new account claims its session only after the payment is confirmed.
 * The answer for a guest is the same whether the email was new or already had an account.
 */
async function handlePOST(request: Request) {
  const ip = clientIp(request.headers);
  await limitOrThrow(`checkout:ip:${ip}`, 30, "1 h");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("CHECKOUT_INVALID_REQUEST", "Please check your details and try again.");
  const { editionIds, method, coupon, turnstileToken } = parsed.data;

  const session = await getSession();
  if (!session && !parsed.data.buyer) throw new AppError("CHECKOUT_DETAILS_REQUIRED", "Please enter your details.");
  if (!session && !(await verifyTurnstile(turnstileToken, ip))) throw new AppError("CHECKOUT_BOT_CHECK_FAILED", "Please complete the security check.");

  // The buyer's phone in E.164 (guests give it in the form; signed-in users have it on the account).
  const phone = session ? (session.user.phoneNumber ?? null) : normalizeKenyanOrE164(parsed.data.buyer!.phone);
  if (!session && !phone) throw new AppError("CHECKOUT_PHONE_INVALID", "Enter a valid phone number.");
  const email = session ? session.user.email : parsed.data.buyer!.email;

  const providerId = method === "card" ? "PAYSTACK" : "MPESA";
  if (!enabledProviders().includes(providerId)) throw new AppError("CHECKOUT_METHOD_UNAVAILABLE", "That payment method is not available right now.");

  // Prices first: a bad cart or a bad coupon must not create an account or burn an attempt.
  const quote = await buildQuote(editionIds, coupon, { userId: session?.user.id });
  if (coupon && quote.couponError) throw new AppError("CHECKOUT_COUPON_INVALID", quote.couponError, 422);
  const free = quote.total === 0;

  // M-Pesa: the phone that gets the prompt. Kenyan only. A phone other than the buyer's own is only for signed-in
  // buyers: a guest typing a stranger's number here is how a prompt gets sent to someone who never asked.
  const rawPay = parsed.data.mpesaPhone ? normalizeKenyanOrE164(parsed.data.mpesaPhone) : phone;
  const payerMsisdn = rawPay ? toMpesaPhone(rawPay) : null;
  if (!free && providerId === "MPESA") {
    if (!payerMsisdn) throw new AppError("CHECKOUT_PHONE_INVALID", "Enter a Kenyan phone number for M-Pesa.");
    if (!session && rawPay !== phone) throw new AppError("CHECKOUT_PAYER_PHONE_NOT_ALLOWED", "Sign in to pay from a different phone number.", 403);
    if (!Number.isInteger(quote.total)) throw new AppError("CHECKOUT_AMOUNT_NOT_WHOLE", "M-Pesa needs a whole-shilling total. Please pay by card instead.");
    await limitOrThrow(`checkout:stk:${payerMsisdn}`, STK_PROMPTS_PER_PHONE, STK_WINDOW, "Too many payment prompts to that phone. Please wait 10 minutes.");
  }

  // The retry ladder (5 tries, then 5/5/10/20/40/60 minute locks, then 24 hours), per email+address pair AND per
  // address. Never per email alone: a stranger typing a victim's email would lock the victim out of checkout.
  const ladderKeys = [`${email}|${ip}`, `ip:${ip}`];
  for (const identity of ladderKeys) {
    const gate = await payLadder.check(identity);
    if (!gate.allowed) {
      const error = gate.contactSupport ? "Too many payment attempts. Please contact support, or try again in 24 hours." : `Too many payment attempts. Try again in ${Math.ceil(gate.retryAfterSeconds / 60)} minutes.`;
      // Answered here, not thrown: the checkout page reads retryAfterSeconds and contactSupport from this body.
      return NextResponse.json({ error, code: "PAY_LOCKED", retryAfterSeconds: gate.retryAfterSeconds, contactSupport: gate.contactSupport }, { status: 429 });
    }
  }

  let buyer: Buyer;
  if (session) {
    buyer = { userId: session.user.id, email: session.user.email, phone, accountCreated: false };
  } else {
    const b = parsed.data.buyer!;
    try {
      buyer = await resolveBuyer({ firstName: b.firstName, lastName: b.lastName, email: b.email, phone: phone! });
    } catch (error) {
      // One generic answer: the specific reason ("that phone belongs to another account") would tell a stranger which phones are registered.
      if (error instanceof BuyerError) throw new AppError("CHECKOUT_DETAILS_REJECTED", "We could not use those details. Check them, or sign in to continue.", 409, { reason: error.code });
      throw error;
    }
  }

  const claim = session ? null : newClaimToken(); // the paying device's secret (also lets a guest read their own order status)
  const created = await createPendingOrder({
    userId: buyer.userId,
    editionIds,
    provider: free ? undefined : providerId,
    coupon,
    claimTokenHash: claim?.hash,
    accountCreated: buyer.accountCreated,
    payerPhone: !free && payerMsisdn ? `+${payerMsisdn}` : undefined,
    reusePending: Boolean(session) && providerId === "MPESA",
  });
  const { order, total, currency } = created;

  // A prompt for this buyer's own earlier order is still on their phone: no second one, just keep waiting for it.
  if (created.reused) return NextResponse.json({ orderId: order.id, reference: order.providerReference, method, accessCode: null, claimToken: null });

  await Promise.all(ladderKeys.map((identity) => payLadder.record(identity)));

  // Always a token for a guest, whether or not the account already existed (for an existing account it can claim nothing).
  const claimToken = claim?.token ?? null;

  if (free) {
    // A 100% coupon: nothing to collect, so grant right away through the same single-writer function.
    const granted = await prisma.$transaction((tx) => markOrderPaid(order.id, {}, tx));
    if (granted) await traced("checkout.post-paid", () => afterOrderPaid(order.id), { orderId: order.id });
    return NextResponse.json({ orderId: order.id, free: true, method, claimToken });
  }

  let result;
  try {
    result = await getProvider(providerId).initialize({
      orderId: order.id,
      reference: order.providerReference ?? "",
      amount: total,
      currency,
      buyer: { email: buyer.email, phone: payerMsisdn ? `+${payerMsisdn}` : undefined },
      returnUrl: `${env.BETTER_AUTH_URL}/checkout/success?ref=${encodeURIComponent(order.providerReference ?? order.id)}`,
    });
  } catch (error) {
    // Safe to fail the order: the provider never accepted the request, so nothing can be charged for it.
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "provider_initialize_failed" } });
    throw new AppError("CHECKOUT_PROVIDER_INIT_FAILED", "We could not start the payment. Nothing was charged. Please try again.", 502, {
      orderId: order.id,
      provider: providerId,
      cause: error instanceof Error ? error.message : String(error),
    });
  }

  // Outside the try above on purpose: the provider has ACCEPTED the payment, so a failed save must never mark the
  // order FAILED (the buyer may still pay). It stays PENDING and the provider's id goes to the log for support.
  if (result.reference !== order.providerReference || result.merchantRequestId) {
    try {
      await prisma.order.update({ where: { id: order.id }, data: { providerReference: result.reference, merchantRequestId: result.merchantRequestId } });
    } catch (error) {
      throw new AppError("CHECKOUT_REFERENCE_SAVE_FAILED", "We could not confirm your payment request. If a payment prompt reaches you, you can complete it; if you are charged and have no access, contact support.", 500, {
        orderId: order.id,
        provider: providerId,
        providerReference: result.reference,
        merchantRequestId: result.merchantRequestId,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    orderId: order.id,
    reference: result.reference,
    method,
    accessCode: result.accessCode ?? null,
    claimToken,
    publicKey: method === "card" ? env.PAYSTACK_PUBLIC_KEY : undefined,
  });
}

export const POST = api("checkout.post", handlePOST);
