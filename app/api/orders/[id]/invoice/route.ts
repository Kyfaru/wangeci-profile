import { NextResponse } from "next/server";

import { findOrderForViewer } from "@/lib/orders/access";
import { invoiceForOrder } from "@/lib/orders/post-paid";

export const dynamic = "force-dynamic";

/** GET /api/orders/[id]/invoice?t=token : the invoice / receipt PDF for a PAID order, for its owner or the paying device. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await findOrderForViewer(id, new URL(request.url).searchParams.get("t"));
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invoice = await invoiceForOrder(found.order.id);
  if (!invoice) return NextResponse.json({ error: "The invoice is available once the payment is confirmed." }, { status: 409 });
  return new NextResponse(Buffer.from(invoice.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.order.invoiceNumber}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
