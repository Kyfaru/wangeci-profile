import { NextResponse } from "next/server";
import { findUserById, toPublicUser } from "@/lib/mock-user";
import { getSessionUserId } from "@/lib/server/mock-auth";

/**
 * GET /api/auth/session — MOCK STUB, not real auth.
 *
 * Reads the mock session cookie (see lib/server/mock-auth.ts), looks up the
 * user, and returns it — or 401 if there's no valid session. This is the
 * endpoint useSession() (lib/hooks/use-session.ts) polls with a 5 min
 * TanStack Query staleTime.
 */
export async function GET() {
  const userId = await getSessionUserId();
  const user = userId ? findUserById(userId) : undefined;

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}
