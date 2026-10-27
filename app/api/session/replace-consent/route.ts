import { NextResponse } from "next/server";
import { z } from "zod";

import { grantReplaceConsent } from "@/lib/auth/session-policy";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { api } from "@/lib/trace";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  identifier: z.string().trim().min(3).max(320),
  /** The one-time `replaceToken` from the SESSION_ALREADY_ACTIVE refusal of a correct code. */
  token: z.string().min(16).max(128),
});

/**
 * POST /api/session/replace-consent: "yes, sign out my other device when I verify".
 * Only the person whose correct code was just refused holds the token, so consent cannot be
 * pre-granted for someone else's account. It signs nobody in: a correct code is still required.
 */
async function handlePOST(request: Request) {
  const ip = clientIp(request.headers);
  if (!(await rateLimit(`replace-consent:${ip}`, 10, "10 m")).ok) {
    return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many requests", details: {} } }, { status: 429 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: { code: "VALIDATION_FAILED", message: "Invalid request", details: {} } }, { status: 400 });

  if (!(await grantReplaceConsent(parsed.data.identifier, parsed.data.token))) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REPLACE_TOKEN_INVALID", message: "That request has expired. Please sign in again.", details: {} } }, { status: 403 });
  }
  return new NextResponse(null, { status: 204 });
}

export const POST = api("session.replace-consent.post", handlePOST);
