import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { supportBridge } from "@/lib/support-bridge";
import { rateLimit } from "@/lib/rate-limit";
import { verifyTurnstile } from "@/lib/turnstile";

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

/** POST /api/contact: the public contact form. Validated, bot-checked, rate-limited, then handed to the SupportBridge. */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  const data = parsed.data;

  // Honeypot filled: pretend it worked so the bot learns nothing, and do nothing.
  if (data.website) return NextResponse.json({ ok: true });

  const [byIp, byEmail] = await Promise.all([rateLimit(`contact:ip:${ip}`, 5, "1 h"), rateLimit(`contact:email:${data.email}`, 3, "1 d")]);
  if (!byIp.ok || !byEmail.ok) {
    return NextResponse.json({ error: "Too many messages. Please try again later." }, { status: 429, headers: { "Retry-After": String(Math.max(byIp.retryAfter, byEmail.retryAfter)) } });
  }

  if (!(await verifyTurnstile(data.token, ip))) {
    return NextResponse.json({ error: "Could not confirm you are human. Please try again." }, { status: 400 });
  }

  try {
    await supportBridge.submit({ id: randomUUID(), name: data.name, email: data.email, message: data.message, source: data.source });
  } catch (error) {
    console.error("[contact] submit failed", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
