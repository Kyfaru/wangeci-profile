import { NextResponse } from "next/server";
import { z } from "zod";

import { grantReplaceConsent } from "@/lib/auth/session-policy";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ identifier: z.string().trim().min(3).max(320) });

/**
 * POST /api/session/replace-consent: "yes, sign out my other device when I verify".
 * Stores a short-lived consent for that email or phone. It signs nobody in: a correct code or
 * Google login is still required, and the answer never says whether the account exists.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!(await rateLimit(`replace-consent:${ip}`, 10, "10 m")).ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await grantReplaceConsent(parsed.data.identifier);
  return new NextResponse(null, { status: 204 });
}
