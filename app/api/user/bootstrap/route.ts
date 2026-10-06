import { NextResponse } from "next/server";

import { getSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const maskEmail = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");
const maskPhone = (p: string | null | undefined) => (p ? `${p.slice(0, 4)}***${p.slice(-2)}` : null);

/** GET /api/user/bootstrap: display-only profile data for the browser cache. No tokens, no entitlements. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { user } = session;
  return NextResponse.json(
    {
      name: user.name,
      email: maskEmail(user.email),
      phone: maskPhone(user.phoneNumber),
      image: user.image ?? null,
      role: user.role,
      complete: user.emailVerified && user.phoneNumberVerified,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
