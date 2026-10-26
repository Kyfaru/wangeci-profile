import { NextResponse } from "next/server";

import { findOrderForViewer, ORDER_TOKEN_HEADER } from "@/lib/orders/access";
import { invoiceForOrder } from "@/lib/orders/post-paid";
import { api } from "@/lib/trace";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/[id]/invoice (token in the x-order-token header): the invoice / receipt PDF for a PAID
 * order. The owner gets the full details; the paying device gets first name and masked contact details.
 */
async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await findOrderForViewer(id, request.headers.get(ORDER_TOKEN_HEADER));
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invoice = await invoiceForOrder(found.order.id, { full: found.signedIn });
  if (!invoice) return NextResponse.json({ error: "The invoice is available once the payment is confirmed." }, { status: 409 });
  return new NextResponse(Buffer.from(invoice.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${invoice.order.invoiceNumber}.pdf"`, "Cache-Control": "private, no-store" },
  });
}

export const GET = api("orders.id.invoice.get", handleGET);
