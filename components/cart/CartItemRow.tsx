"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";
import { findBookBySlug } from "@/lib/mock-books";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";
import { MinusIcon, PlusIcon, TrashIcon } from "./icons";

export interface CartItemRowProps {
  item: CartItem;
  className?: string;
}

const THUMBNAIL_CLASSES =
  "relative aspect-3/4 w-16 shrink-0 overflow-hidden rounded-lg bg-linear-to-br from-navy to-navy/80 sm:w-20";

/**
 * One line item in `/cart` — cover placeholder, title, unit price, a
 * quantity stepper, a remove button, and a line total.
 *
 * Reads/writes `useCartStore` directly (the same self-contained pattern
 * `BuyBookButton` uses), so `/cart/page.tsx` stays a thin list of these.
 * Enriches against `lib/mock-books.ts` for the freshest title/price when the
 * line is a book (falling back to whatever was captured on the cart line
 * itself, which also covers non-book `type: "product"` lines).
 */
export function CartItemRow({ item, className }: CartItemRowProps) {
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);

  const book = item.type === "book" ? findBookBySlug(item.itemId) : undefined;
  const title = book?.title ?? item.title;
  const price = book?.price ?? item.price;
  const currency = book?.currency ?? item.currency;
  const lineTotal = price * item.qty;

  const thumbnail = (
    <div className={THUMBNAIL_CLASSES}>
      <div className="absolute inset-0 flex items-center justify-center p-1.5 text-center">
        <span className="font-display text-[10px] leading-snug text-cream sm:text-xs">
          {title}
        </span>
      </div>
    </div>
  );

  return (
    <Card
      padding="sm"
      className={cn("flex flex-wrap items-center gap-4", className)}
    >
      {item.type === "book" ? (
        <Link href={`/store/${item.itemId}`} aria-hidden="true" tabIndex={-1}>
          {thumbnail}
        </Link>
      ) : (
        thumbnail
      )}

      <div className="flex min-w-40 flex-1 flex-col gap-1">
        {item.type === "book" ? (
          <Link
            href={`/store/${item.itemId}`}
            className="truncate font-display text-base text-navy hover:text-gold"
          >
            {title}
          </Link>
        ) : (
          <span className="truncate font-display text-base text-navy">
            {title}
          </span>
        )}
        <span className="text-sm text-gray">
          {currency} {price.toLocaleString()} each
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-full border border-navy/15 p-1">
        <button
          type="button"
          aria-label={`Decrease quantity of ${title}`}
          onClick={() => updateQty(item.id, item.qty - 1)}
          className="inline-flex size-7 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/5"
        >
          <MinusIcon className="size-3.5" />
        </button>
        <span
          className="w-5 text-center text-sm font-medium text-navy"
          aria-live="polite"
        >
          {item.qty}
        </span>
        <button
          type="button"
          aria-label={`Increase quantity of ${title}`}
          onClick={() => updateQty(item.id, item.qty + 1)}
          className="inline-flex size-7 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/5"
        >
          <PlusIcon className="size-3.5" />
        </button>
      </div>

      <span className="w-24 shrink-0 text-right font-display text-base text-navy">
        {currency} {lineTotal.toLocaleString()}
      </span>

      <button
        type="button"
        aria-label={`Remove ${title} from cart`}
        onClick={() => removeItem(item.id)}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-gray transition-colors hover:bg-error/10 hover:text-error"
      >
        <TrashIcon className="size-4" />
      </button>
    </Card>
  );
}
