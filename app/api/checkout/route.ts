import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { payLadder } from "@/lib/checkout/attempt-ladder";
import { BuyerError, newClaimToken, resolveBuyer, type Buyer } from "@/lib/checkout/guest";
import { buildQuote, QuoteError } from "@/lib/checkout/quote";
import { env } from "@/lib/env";
import { CheckoutError, createPendingOrder } from "@/lib/orders/create";
import { markOrderPaid } from "@/lib/orders/grant";
import { afterOrderPaid } from "@/lib/orders/post-paid";
import { enabledProviders, getProvider } from "@/lib/payments";
import { toMpesaPhone } from "@/lib/payments/mpesa";
import { normalizeKenyanOrE164 } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const name = z.string().trim().min(1).max(60);
// Only edition ids, a coupon code, the chosen method and the buyer's own details come from the browser.
// Prices, totals and currency never do: any "price" field a client sends is dropped by this schema.
const bodySchema = z.object({
  editionIds: z.array(z.string().min(1).max(64)).min(1).max(10),
  method: z.enum(["card", "mpesa"]),
  coupon: z.string().trim().max(40).optional(),
  /** M-Pesa only: a different phone for the prompt. Defaults to the buyer's phone. */
  mpesaPhone: z.string().trim().max(20).optional(),
  buyer: z.object({ firstName: name, lastName: name, email: z.string().trim().toLowerCase().email().max(120), phone: z.string().trim().min(7).max(20) }).optional(),
  turnstileToken: z.string().max(2048).optional(),
});

const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
const retryMessage = (seconds: number, support: boolean) =>
  support ? "Too many payment attempts. Please contact support, or try again in 24 hours." : `Too many payment attempts. Try again in ${Math.ceil(seconds / 60)} minutes.`;

/**
 * POST /api/checkout: starts a payment for a signed-in buyer OR a guest (who gets an account made for them).
 * Order of checks: shape, rate limit, bot check (guests), prices (nothing is created if the cart is bad),
 * the retry ladder, then the account and the order. A guest NEVER gets a session here: the existing-account
 * case would be an account takeover, and a new account claims its session only after the payment is confirmed.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  if (!(await rateLimit(`checkout:ip:${ip}`, 30, "1 h")).ok) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check your details and try again." }, { status: 400 });
  const { editionIds, method, coupon, turnstileToken } = parsed.data;

  const session = await getSession();
  if (!session && !parsed.data.buyer) return NextResponse.json({ error: "Please enter your details." }, { status: 400 });
  if (!session && !(await verifyTurnstile(turnstileToken, ip))) return NextResponse.json({ error: "Please complete the security check." }, { status: 400 });

  // The buyer's phone in E.164 (guests give it in the form; signed-in users have it on the account).
  const phone = session ? (session.user.phoneNumber ?? null) : normalizeKenyanOrE164(parsed.data.buyer!.phone);
  if (!session && !phone) return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  const email = session ? session.user.email : parsed.data.buyer!.email;

  const providerId = method === "card" ? "PAYSTACK" : "MPESA";
  if (!enabledProviders().includes(providerId)) return NextResponse.json({ error: "That payment method is not available right now." }, { status: 400 });

  // Prices first: a bad cart or a bad coupon must not create an account or burn an attempt.
  let quote;
  try {
    quote = await buildQuote(editionIds, coupon);
  } catch (error) {
    if (error instanceof QuoteError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
  if (coupon && quote.couponError) return NextResponse.json({ error: quote.couponError, code: "COUPON" }, { status: 422 });
  const free = quote.total === 0;

  // M-Pesa: the phone that gets the prompt. Kenyan only.
  const rawPay = parsed.data.mpesaPhone ? normalizeKenyanOrE164(parsed.data.mpesaPhone) : phone;
  const payerMsisdn = rawPay ? toMpesaPhone(rawPay) : null;
  if (!free && providerId === "MPESA" && !payerMsisdn) return NextResponse.json({ error: "Enter a Kenyan phone number for M-Pesa." }, { status: 400 });

  // The retry ladder (5 tries, then 5/5/10/20/40/60 minute locks, then 24 hours), per email AND per network address.
  for (const identity of [email, `ip:${ip}`]) {
    const gate = await payLadder.check(identity);
    if (!gate.allowed) {
      return NextResponse.json({ error: retryMessage(gate.retryAfterSeconds, gate.contactSupport), code: "PAY_LOCKED", retryAfterSeconds: gate.retryAfterSeconds, contactSupport: gate.contactSupport }, { status: 429 });
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
      if (error instanceof BuyerError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
      throw error;
    }
  }

  const claim = session ? null : newClaimToken(); // the paying device's secret (also lets a guest read their own order status)
  let created;
  try {
    created = await createPendingOrder({
      userId: buyer.userId,
      editionIds,
      provider: free ? undefined : providerId,
      coupon,
      claimTokenHash: claim?.hash,
      accountCreated: buyer.accountCreated,
      payerPhone: !free && payerMsisdn ? `+${payerMsisdn}` : undefined,
    });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
  const { order, total, currency } = created;

  await Promise.all([payLadder.record(email), payLadder.record(`ip:${ip}`)]);

  if (free) {
    // A 100% coupon: nothing to collect, so grant right away through the same single-writer function.
    const granted = await prisma.$transaction((tx) => markOrderPaid(order.id, {}, tx));
    if (granted) await afterOrderPaid(order.id).catch((e) => console.error("[checkout] post-payment steps failed", e));
    return NextResponse.json({ orderId: order.id, free: true, method, claimToken: claim?.token ?? null, accountCreated: buyer.accountCreated });
  }

  try {
    const result = await getProvider(providerId).initialize({
      orderId: order.id,
      reference: order.providerReference ?? "",
      amount: total,
      currency,
      buyer: { email: buyer.email, phone: payerMsisdn ? `+${payerMsisdn}` : undefined },
      returnUrl: `${env.BETTER_AUTH_URL}/checkout/success?ref=${encodeURIComponent(order.providerReference ?? order.id)}`,
    });
    await prisma.order.update({ where: { id: order.id }, data: { providerReference: result.reference, merchantRequestId: result.merchantRequestId } });
    return NextResponse.json({
      orderId: order.id,
      reference: result.reference,
      method,
      accessCode: result.accessCode ?? null,
      claimToken: claim?.token ?? null,
      accountCreated: buyer.accountCreated,
      publicKey: method === "card" ? env.PAYSTACK_PUBLIC_KEY : undefined,
    });
  } catch (error) {
    console.error("[checkout] provider initialize failed", error);
    Sentry.captureException(error);
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "provider_initialize_failed" } });
    return NextResponse.json({ error: "We could not start the payment. Nothing was charged. Please try again." }, { status: 502 });
  }
}
