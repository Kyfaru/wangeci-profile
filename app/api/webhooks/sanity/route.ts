import { createHmac } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { AppError, api, safeEqual } from "@/lib/trace";

export const dynamic = "force-dynamic";

/** Cache tag every Sanity fetch carries (see app/(marketing)/blog/sanity.ts). */
const SANITY_TAG = "sanity";
const MAX_AGE_MS = 300_000; // replay guard: a signed payload older (or newer) than 5 minutes is refused

/** Header is "t=<timestamp ms>,v1=<signature>"; signature = base64url(HMAC-SHA256(secret, "<t>.<raw body>")). */
function isValidSignature(rawBody: string, header: string | null, secret: string): boolean {
  const match = /^t=(\d+)[, ]+v1=([^, ]+)$/.exec((header ?? "").trim());
  if (!match || Math.abs(Date.now() - Number(match[1])) > MAX_AGE_MS) return false;
  return safeEqual(createHmac("sha256", secret).update(`${match[1]}.${rawBody}`).digest("base64url"), match[2]);
}

/**
 * POST /api/webhooks/sanity: content changed in Sanity. Marks the blog's cached data stale so the next
 * visit shows the new post. Absent (404) unless SANITY_WEBHOOK_SECRET is set.
 */
export const POST = api("webhooks.sanity.post", async (request) => {
  if (!env.SANITY_WEBHOOK_SECRET) throw new AppError("SANITY_DISABLED", "Not found", 404);

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)) {
    throw new AppError("SANITY_BAD_SIGNATURE", "Signature check failed.", 401);
  }

  revalidateTag(SANITY_TAG, "max"); // stale-while-revalidate, per the Next 16 docs
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  return NextResponse.json({ revalidated: true });
});
