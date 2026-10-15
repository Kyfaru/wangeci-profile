import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { AppError, api } from "@/lib/trace";

export const dynamic = "force-dynamic";

/** Cache tag every Sanity fetch carries (see app/(marketing)/blog/sanity.ts). */
const SANITY_TAG = "sanity";
const MIN_TIMESTAMP_MS = 1609459200000; // the earliest a Sanity-signed payload can be dated (2021-01-01), as in @sanity/webhook

/** Header is "t=<timestamp>,v1=<signature>"; signature = base64url(HMAC-SHA256(secret, "<t>.<raw body>")). */
function isValidSignature(rawBody: string, header: string | null, secret: string): boolean {
  const match = /^t=(\d+)[, ]+v1=([^, ]+)$/.exec((header ?? "").trim());
  if (!match || Number(match[1]) < MIN_TIMESTAMP_MS) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${match[1]}.${rawBody}`).digest("base64url"));
  const received = Buffer.from(match[2]);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * POST /api/webhooks/sanity: content changed in Sanity. Marks the blog's cached data stale so the next
 * visit shows the new post. Absent (404) unless SANITY_WEBHOOK_SECRET is set.
 */
export const POST = api("webhooks.sanity.post", async (request) => {
  if (!env.SANITY_WEBHOOK_SECRET) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("sanity-webhook-signature"), env.SANITY_WEBHOOK_SECRET)) {
    throw new AppError("SANITY_BAD_SIGNATURE", "Signature check failed.", 401);
  }

  revalidateTag(SANITY_TAG, "max"); // stale-while-revalidate, per the Next 16 docs
  revalidatePath("/blog");
  revalidatePath("/blog/[slug]", "page");
  return NextResponse.json({ revalidated: true });
});
