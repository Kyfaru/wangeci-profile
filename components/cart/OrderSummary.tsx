import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";

export interface OrderSummaryLine {
  id: string;
  title: string;
  qty: number;
  price: number;
}

export interface OrderSummaryProps {
  lines: OrderSummaryLine[];
  currency: string;
  /** Rendered below the totals — typically a CTA button (+ its error text). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Order totals card shared by `/cart` and `/checkout`.
 *
 * This is a digital (ebook) storefront and no shipping/tax model exists yet
 * (see the plan's open questions — checkout defaults to digital/contact-info
 * only) so subtotal and total are currently the same figure. Kept as two
 * separate rows anyway so a shipping/tax line is a one-line addition later
 * instead of a restructure.
 */
export function OrderSummary({
  lines,
  currency,
  footer,
  className,
}: OrderSummaryProps) {
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  const total = subtotal;

  return (
    <Card padding="lg" className={cn("flex flex-col gap-5", className)}>
      <h2 className="font-display text-xl text-navy">Order Summary</h2>

      <div className="flex flex-col gap-3">
        {lines.map((line) => (
          <div
            key={line.id}
            className="flex items-start justify-between gap-4 text-sm"
          >
            <span className="text-navy/80">
              {line.title}
              <span className="text-gray"> × {line.qty}</span>
            </span>
            <span className="shrink-0 font-medium text-navy">
              {currency} {(line.price * line.qty).toLocaleString()}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-navy/10 pt-4 text-sm">
        <div className="flex items-center justify-between text-navy/70">
          <span>Subtotal</span>
          <span>
            {currency} {subtotal.toLocaleString()}
          </span>
        </div>
        <p className="text-xs text-gray">
          Digital delivery — no shipping required.
        </p>
      </div>

      <div className="flex items-center justify-between border-t border-navy/10 pt-4">
        <span className="font-display text-lg text-navy">Total</span>
        <span className="font-display text-lg text-navy">
          {currency} {total.toLocaleString()}
        </span>
      </div>

      {footer}
    </Card>
  );
}
