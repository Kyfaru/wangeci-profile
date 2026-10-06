import { NextResponse } from "next/server";
import { z } from "zod";

import { buildQuote, QuoteError } from "@/lib/checkout/quote";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({ editionIds: z.array(z.string().min(1).max(64)).min(1).max(10), coupon: z.string().trim().max(40).optional() });

/** POST /api/checkout/quote: the prices the order would really use (works for guests; nothing is created). */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`quote:${ip}`, 60, "10 m")).ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  try {
    const { coupon, ...quote } = await buildQuote(parsed.data.editionIds, parsed.data.coupon);
    return NextResponse.json({ ...quote, couponCode: coupon?.code ?? null });
  } catch (error) {
    if (error instanceof QuoteError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    throw error;
  }
}
