import { NextResponse } from "next/server";
import { z } from "zod";

import { limitOrThrow } from "@/lib/checkout/limits";
import { buildQuote } from "@/lib/checkout/quote";
import { clientIp } from "@/lib/rate-limit";
import { getSession } from "@/lib/server/session";
import { AppError, api } from "@/lib/trace";

export const dynamic = "force-dynamic";

const schema = z.object({ editionIds: z.array(z.string().min(1).max(64)).min(1).max(10), coupon: z.string().trim().max(40).optional() });

/** POST /api/checkout/quote: the prices the order would really use (works for guests; nothing is created). */
async function handlePOST(request: Request) {
  await limitOrThrow(`quote:${clientIp(request.headers)}`, 60, "10 m", "Too many requests.");
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("CHECKOUT_INVALID_REQUEST", "Invalid request.");
  const session = await getSession();
  const { coupon, ...quote } = await buildQuote(parsed.data.editionIds, parsed.data.coupon, { userId: session?.user.id });
  return NextResponse.json({ ...quote, couponCode: coupon?.code ?? null });
}

export const POST = api("checkout.quote.post", handlePOST);
