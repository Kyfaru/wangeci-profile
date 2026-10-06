import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { SITE } from "@/lib/site";

export interface InvoiceData {
  invoiceNumber: string;
  paidAt: Date;
  currency: string;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
  items: { title: string; price: number }[];
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  couponCode: string | null;
  method: string;
  reference: string;
}

const NAVY = rgb(0.047, 0.129, 0.259);
const GREY = rgb(0.42, 0.45, 0.5);
const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A one-page "Invoice / Receipt" (the payment is already made). Standard fonts only: no files to ship. */
export async function buildInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const left = 50;
  const right = 545;
  let y = 790;

  const text = (s: string, x: number, size = 10, f = font, color = NAVY) => page.drawText(s, { x, y, size, font: f, color });
  const rightText = (s: string, size = 10, f = font) => page.drawText(s, { x: right - f.widthOfTextAtSize(s, size), y, size, font: f, color: NAVY });

  text(SITE.brand, left, 22, bold);
  y -= 18;
  text(SITE.authorName, left, 10, font, GREY);
  y -= 13;
  // TODO(client): the registered business name, address and KRA PIN go here once supplied.
  text("TODO(client): business name, address and PIN", left, 9, font, GREY);

  y = 790;
  rightText("INVOICE / RECEIPT", 16, bold);
  y -= 18;
  rightText(d.invoiceNumber, 11, bold);
  y -= 14;
  rightText(`Paid on ${d.paidAt.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}`, 10);

  y = 700;
  text("BILLED TO", left, 9, bold, GREY);
  y -= 16;
  text(d.buyerName, left, 11, bold);
  y -= 14;
  text(d.buyerEmail, left);
  if (d.buyerPhone) {
    y -= 13;
    text(d.buyerPhone, left);
  }

  y = 610;
  page.drawRectangle({ x: left, y: y - 6, width: right - left, height: 22, color: rgb(0.96, 0.94, 0.9) });
  text("Item", left + 8, 10, bold);
  rightText("Amount", 10, bold);
  y -= 26;
  for (const item of d.items) {
    text(item.title.slice(0, 70), left + 8);
    rightText(money(item.price, d.currency));
    y -= 18;
  }

  y -= 10;
  const row = (label: string, value: string, strong = false) => {
    text(label, 340, strong ? 12 : 10, strong ? bold : font);
    rightText(value, strong ? 12 : 10, strong ? bold : font);
    y -= strong ? 20 : 16;
  };
  row("Subtotal", money(d.subtotal, d.currency));
  if (d.discount > 0) row(d.couponCode ? `Discount (${d.couponCode})` : "Discount", `- ${money(d.discount, d.currency)}`);
  if (d.fee > 0) row("Fees", money(d.fee, d.currency));
  page.drawLine({ start: { x: 340, y: y + 10 }, end: { x: right, y: y + 10 }, thickness: 0.8, color: NAVY });
  row("Total paid", money(d.total, d.currency), true);

  y -= 20;
  text("PAYMENT", left, 9, bold, GREY);
  y -= 16;
  text(`Method: ${d.method}`, left);
  y -= 14;
  text(`Reference: ${d.reference}`, left);

  y = 70;
  text("Digital goods: delivered to your account on payment. Thank you for supporting independent authors.", left, 9, font, GREY);

  return pdf.save();
}
