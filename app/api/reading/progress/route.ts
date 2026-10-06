import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";

/**
 * POST /api/reading/progress: signed-in users only. It used to accept any body
 * from anyone and save nothing. Phase 4 validates with zod, checks the
 * Entitlement, rate-limits and upserts ReadingPosition.
 */
export async function POST() {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
