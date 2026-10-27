import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { notifyAdmins } from "@/lib/server/notify-admins";
import { clientIp, limit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import { AppError, api } from "@/lib/trace";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  message: z.string().trim().min(10).max(3000),
  source: z.enum(["/contact", "/services"]).default("/contact"),
  token: z.string().max(4096).optional(),
  // Honeypot: a real person never sees or fills this field. Bots fill every field.
  website: z.string().max(200).optional(),
});

/** POST /api/contact: the public contact form. Validated, bot-checked, rate-limited, then put in front of the admins. */
async function handlePOST(request: Request) {
  const ip = clientIp(request.headers);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppError("CONTACT_INVALID", "Please check the form and try again.", 400);
  const data = parsed.data;

  // Honeypot filled: pretend it worked so the bot learns nothing, and do nothing.
  if (data.website) return NextResponse.json({ ok: true });

  const tooMany = "Too many messages. Please try again later.";
  await limit(`contact:ip:${ip}`, 5, "1 h", tooMany);
  await limit(`contact:email:${data.email}`, 3, "1 d", tooMany);

  if (!(await verifyTurnstile(data.token, ip))) {
    throw new AppError("CONTACT_BOT_CHECK", "Could not confirm you are human. Please try again.", 400);
  }

  await notifyAdmins({
    type: "contact_message",
    title: `New message from ${data.name}`,
    body: `${data.name} <${data.email}>\nvia ${data.source}\n\n${data.message}`,
    link: "/admin/inbox",
    dedupeKey: `contact:${randomUUID()}`,
    urgent: true,
  });
  return NextResponse.json({ ok: true });
}

export const POST = api("contact.post", handlePOST);
