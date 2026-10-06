import { NextResponse } from "next/server";

/**
 * GET /api/reader/chapter: closed until Phase 4 builds the real path
 * (session + Entitlement check, one chapter per request). The old version
 * returned any chapter to anyone.
 */
export function GET() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
