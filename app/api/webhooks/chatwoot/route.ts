import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { notifyAdmins } from "@/lib/server/notify-admins";
import { AppError, api, safeEqual } from "@/lib/trace";

export const dynamic = "force-dynamic";

const MAX_AGE_SECONDS = 300; // Chatwoot suggests rejecting signatures older than 5 minutes (replay guard)
const MAX_MESSAGE_CHARS = 1000;

interface ChatwootMessage {
  event?: string;
  id?: number | string;
  content?: string | null;
  message_type?: string | number;
  private?: boolean;
  sender?: { name?: string; email?: string };
  contact?: { name?: string; email?: string };
  conversation?: { id?: number | string; display_id?: number | string };
}

/** Chatwoot signs "<X-Chatwoot-Timestamp>.<raw body>" with HMAC-SHA256 and sends "sha256=<hex>". */
function isValidSignature(rawBody: string, request: Request, secret: string): boolean {
  const signature = request.headers.get("x-chatwoot-signature") ?? "";
  const timestamp = request.headers.get("x-chatwoot-timestamp") ?? "";
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!signature || !Number.isFinite(age) || age > MAX_AGE_SECONDS) return false;
  return safeEqual(`sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`, signature);
}

/**
 * POST /api/webhooks/chatwoot: a visitor wrote in the chat widget. Puts one bell item in front of the
 * admins. Agent replies and private notes are ignored. Retries are harmless: the key is conversation +
 * message id. Absent (404) unless CHATWOOT_WEBHOOK_SECRET is set.
 */
export const POST = api("webhooks.chatwoot.post", async (request) => {
  if (!env.CHATWOOT_WEBHOOK_SECRET) throw new AppError("CHATWOOT_DISABLED", "Not found", 404);

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request, env.CHATWOOT_WEBHOOK_SECRET)) {
    throw new AppError("CHATWOOT_BAD_SIGNATURE", "Signature check failed.", 401);
  }

  let payload: ChatwootMessage;
  try {
    payload = JSON.parse(rawBody) as ChatwootMessage;
  } catch {
    throw new AppError("CHATWOOT_BAD_PAYLOAD", "Body is not JSON.", 400);
  }

  const incoming = payload.message_type === "incoming" || payload.message_type === 0;
  const conversationId = payload.conversation?.id ?? payload.conversation?.display_id;
  if (payload.event !== "message_created" || !incoming || payload.private || payload.id == null || conversationId == null) {
    return NextResponse.json({ received: true });
  }

  const who = payload.sender ?? payload.contact;
  const name = who?.name || "A website visitor";
  await notifyAdmins({
    type: "contact_message",
    title: `New message from ${name}`,
    body: `${name} <${who?.email || "no email given"}>\nvia live chat\n\n${(payload.content ?? "").slice(0, MAX_MESSAGE_CHARS)}`,
    link: "/admin/inbox",
    dedupeKey: `contact:chatwoot:${conversationId}:${payload.id}`,
    urgent: true,
  });
  return NextResponse.json({ received: true });
});
