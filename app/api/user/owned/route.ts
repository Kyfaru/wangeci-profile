import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/server/session";
import { api } from "@/lib/trace";

export const dynamic = "force-dynamic";

/** GET /api/user/owned : the edition ids this person owns (lets the book page show "Read now" instead of "Buy"). */
async function handleGET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ editionIds: [] }, { headers: { "Cache-Control": "no-store" } });
  const rows = await prisma.entitlement.findMany({ where: { userId: session.user.id }, select: { editionId: true } });
  return NextResponse.json({ editionIds: rows.map((r) => r.editionId) }, { headers: { "Cache-Control": "no-store" } });
}

export const GET = api("user.owned.get", handleGET);
