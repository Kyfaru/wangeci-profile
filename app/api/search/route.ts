import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/search?q= : books only (title or description). Pages for other content are searched when they exist. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return NextResponse.json({ query: q, results: [], total: 0 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`search:${ip}`, 60, "1 m")).ok) return NextResponse.json({ error: "Too many searches" }, { status: 429 });

  const works = await prisma.work.findMany({
    where: {
      editions: { some: { isActive: true, format: { in: ["EPUB", "AUDIOBOOK"] } } },
      OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }],
    },
    select: { slug: true, title: true, description: true },
    take: 10,
  });

  const results = works.map((w) => ({ type: "book" as const, id: w.slug, title: w.title, snippet: w.description ?? "", url: `/store/${w.slug}` }));
  return NextResponse.json({ query: q, results, total: results.length });
}
