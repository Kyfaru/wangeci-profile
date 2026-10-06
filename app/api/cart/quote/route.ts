import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const idsSchema = z.array(z.string().min(1).max(64)).min(1).max(10);

/**
 * GET /api/cart/quote?ids=a,b : server prices for the editions in a browser cart, for DISPLAY only.
 * The browser cart is a shopping list; checkout re-reads every price from the database again.
 */
export async function GET(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`quote:${ip}`, 60, "1 m")).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const parsed = idsSchema.safeParse((request.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean));
  if (!parsed.success) return NextResponse.json({ items: [], total: 0, currency: "KES" });

  const editions = await prisma.edition.findMany({
    where: { id: { in: parsed.data }, isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } },
    include: { work: { select: { slug: true, title: true } } },
  });
  const items = editions.map((e) => ({
    editionId: e.id,
    slug: e.work.slug,
    title: e.title ?? e.work.title,
    format: e.format === "EPUB" ? "ebook" : "audiobook",
    price: Number(e.price),
    currency: e.currency,
  }));
  return NextResponse.json({ items, total: items.reduce((n, i) => n + i.price, 0), currency: items[0]?.currency ?? "KES" });
}
