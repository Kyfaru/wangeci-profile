import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";

/** Bookmarks need a Bookmark table (Phase 1 migration) and an entitlement check (Phase 4). */
export async function GET() {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: [], total: 0 });
}

export async function POST() {
  if (!(await getSessionUserId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
