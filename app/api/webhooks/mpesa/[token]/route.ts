import { NextResponse } from "next/server";

import { applyProviderEvent } from "@/lib/orders/apply-event";
import { mpesa, verifyCallbackToken } from "@/lib/payments/mpesa";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/mpesa/<secret>: Safaricom's STK push result. Safaricom does not sign callbacks,
 * so the URL itself carries a secret; any other path segment is a plain 404. A "paid" result is still
 * confirmed with Safaricom's query API before access is granted (see applyProviderEvent).
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  if (!verifyCallbackToken((await params).token)) return new NextResponse(null, { status: 404 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" }); // nothing we can do with it; stop retries
  }

  try {
    await applyProviderEvent(mpesa.parseEvent(payload));
  } catch (error) {
    console.error("[webhooks/mpesa] processing failed", error);
    return NextResponse.json({ ResultCode: 1, ResultDesc: "Temporary failure" }, { status: 503 });
  }
  return NextResponse.json({ ResultCode: 0, ResultDesc: "Accepted" });
}
