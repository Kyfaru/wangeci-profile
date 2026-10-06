import { Receiver } from "@upstash/qstash";
import { NextResponse } from "next/server";
import { z } from "zod";

import { env } from "@/lib/env";
import { deliverOtp } from "@/lib/queue";

export const dynamic = "force-dynamic";

const jobSchema = z.object({
  channel: z.enum(["email", "sms"]),
  to: z.string().min(3).max(320),
  code: z.string().regex(/^\d{4,8}$/),
});

/**
 * POST /api/qstash/send-otp: the queue worker. Only QStash may call it: the request carries an
 * Upstash-Signature header that we verify against the raw body BEFORE parsing anything.
 */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("upstash-signature");

  if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY || !signature) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const receiver = new Receiver({
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
  });
  const valid = await receiver.verify({ signature, body }).catch(() => false);
  if (!valid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = jobSchema.safeParse(JSON.parse(body));
  if (!parsed.success) return NextResponse.json({ error: "Bad job" }, { status: 400 });

  // A thrown error returns 500 so QStash retries; the notification_log row records each attempt.
  await deliverOtp(parsed.data);
  return NextResponse.json({ ok: true });
}
