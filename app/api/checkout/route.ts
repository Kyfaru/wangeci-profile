import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { CheckoutError, createPendingOrder } from "@/lib/orders/create";
import { enabledProviders, getProvider } from "@/lib/payments";
import { toMpesaPhone } from "@/lib/payments/mpesa";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

// Only edition ids and the chosen method come from the browser. Prices, totals and currency never do:
// any "price" field a client sends is dropped by this schema and ignored.
const bodySchema = z.object({
  editionIds: z.array(z.string().min(1).max(64)).min(1).max(10),
  method: z.enum(["card", "mpesa"]),
  phone: z.string().trim().max(20).optional(),
});

/** POST /api/checkout: creates a PENDING order and starts the payment. Signed-in, verified accounts only. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { user } = session;
  if (!user.emailVerified || !user.phoneNumberVerified) return NextResponse.json({ error: "Please finish verifying your account." }, { status: 403 });

  if (!(await rateLimit(`checkout:${user.id}`, 10, "1 h")).ok) return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { editionIds, method } = parsed.data;

  const providerId = method === "card" ? "PAYSTACK" : "MPESA";
  if (!enabledProviders().includes(providerId)) return NextResponse.json({ error: "That payment method is not available right now." }, { status: 400 });

  // M-Pesa: the phone that gets the prompt. Defaults to the verified account phone; must be Kenyan.
  const raw = parsed.data.phone ? (parsed.data.phone.startsWith("+") ? parsed.data.phone : `+${parsed.data.phone}`) : user.phoneNumber;
  const payerPhone = raw ? toMpesaPhone(raw) : null;
  if (providerId === "MPESA" && !payerPhone) return NextResponse.json({ error: "Enter a Kenyan phone number for M-Pesa." }, { status: 400 });

  let created;
  try {
    created = await createPendingOrder({ userId: user.id, editionIds, provider: providerId });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
  const { order, total, currency } = created;

  try {
    const result = await getProvider(providerId).initialize({
      orderId: order.id,
      reference: order.providerReference ?? "",
      amount: total,
      currency,
      buyer: { email: user.email, phone: payerPhone ? `+${payerPhone}` : undefined },
      returnUrl: `${env.BETTER_AUTH_URL}/checkout/success?ref=${encodeURIComponent(order.providerReference ?? order.id)}`,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { providerReference: result.reference, merchantRequestId: result.merchantRequestId, payerPhone: payerPhone ? `+${payerPhone}` : undefined },
    });
    // The shopping list has served its purpose; a failed payment can simply add the items again.
    await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id }, editionId: { in: editionIds } } });
    return NextResponse.json({ orderId: order.id, reference: result.reference, redirectUrl: result.redirectUrl ?? null });
  } catch (error) {
    console.error("[checkout] provider initialize failed", error);
    Sentry.captureException(error);
    await prisma.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "FAILED", failureReason: "provider_initialize_failed" } });
    return NextResponse.json({ error: "We could not start the payment. Nothing was charged. Please try again." }, { status: 502 });
  }
}
