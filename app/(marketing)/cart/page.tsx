"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { removeFromCart } from "@/app/actions/cart";
import { BOOK_HREF } from "@/lib/content/landing";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useCartStore } from "@/lib/stores/cart-store";

const money = (n: number, currency: string) => `${currency} ${n.toLocaleString("en-KE")}`;

/**
 * `/cart` — not in Figma; built from the project tokens. Reads the
 * localStorage-persisted `useCartStore`, so the body waits for hydration.
 */
export default function CartPage() {
  const hydrated = useHydrated();
  const { items, removeItem, reconcile } = useCartStore();
  const [dropped, setDropped] = useState<string[]>([]);
  const [opening, setOpening] = useState(false);
  const editionKey = items.map((i) => i.editionId).filter(Boolean).join(",");

  // The cart is a shopping list. Ask the server what is really for sale and what it costs right now.
  useEffect(() => {
    if (!hydrated || !editionKey) return;
    let cancelled = false;
    fetch(`/api/cart/quote?ids=${encodeURIComponent(editionKey)}`)
      .then((r) => r.json())
      .then((q: { items?: { editionId: string; price: number; currency: string }[] }) => {
        if (cancelled || !q.items) return;
        const sellable = new Set(q.items.map((i) => i.editionId));
        const gone = useCartStore.getState().items.filter((i) => i.type === "book" && i.editionId && !sellable.has(i.editionId));
        reconcile(q.items);
        if (gone.length === 0) return;
        setDropped(gone.map((i) => i.title));
        void removeFromCart(gone.map((i) => i.editionId as string));
      })
      .catch(() => {}); // display-only prices: checkout re-reads them, so a failed refresh just keeps the saved ones
    return () => {
      cancelled = true;
    };
  }, [hydrated, editionKey, reconcile]);

  // Display only: checkout re-reads every price from the database. Books are always quantity one.
  const subtotals = new Map<string, number>();
  for (const i of items) subtotals.set(i.currency, (subtotals.get(i.currency) ?? 0) + i.price);
  const mixedCurrencies = subtotals.size > 1;

  function remove(id: string, editionId?: string) {
    removeItem(id);
    if (editionId) void removeFromCart([editionId]); // also drop it from the saved cart that checkout merges
  }

  return (
    <div className="mx-auto min-h-[70vh] max-w-[1100px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Your Cart</h1>

      {!hydrated && (
        <div className="mt-10 space-y-4" aria-hidden>
          <div className="h-28 animate-pulse rounded-[30px] bg-navy/10" />
          <div className="h-28 animate-pulse rounded-[30px] bg-navy/10" />
        </div>
      )}

      {dropped.length > 0 && (
        <p role="status" className="mt-6 rounded-2xl bg-white p-4 text-navy">
          {dropped.join(", ")} {dropped.length > 1 ? "are" : "is"} no longer available and {dropped.length > 1 ? "were" : "was"} removed from your cart.
        </p>
      )}

      {hydrated && items.length === 0 && (
        <div className="mt-10">
          <p className="text-xl text-navy/70">Your cart is empty.</p>
          <Link
            href={BOOK_HREF}
            className="mt-6 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold"
          >
            Browse the book
          </Link>
        </div>
      )}

      {hydrated && items.length > 0 && (
        <div className="mt-10 grid items-start gap-10 lg:grid-cols-[1fr_340px]">
          <ul className="flex flex-col gap-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[72px_1fr] items-center gap-x-5 gap-y-3 rounded-[30px] bg-[rgb(230_224_212/0.95)] p-5 sm:grid-cols-[72px_1fr_auto]"
              >
                <div className="relative aspect-[3/4] w-[72px] overflow-hidden rounded-lg bg-navy/10">
                  {item.image && <Image src={item.image} alt="" fill sizes="72px" className="object-cover" />}
                </div>
                <div>
                  <p className="text-xl font-medium text-navy">{item.title}</p>
                  <button
                    type="button"
                    onClick={() => remove(item.id, item.editionId)}
                    className="mt-1 text-sm text-navy/60 underline underline-offset-4 hover:text-gold"
                  >
                    Remove
                  </button>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-6 sm:col-span-1 sm:flex-col sm:items-end sm:gap-3">
                  <p className="text-lg font-medium text-navy">{money(item.price, item.currency)}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="rounded-[30px] bg-navy p-8 text-cream lg:sticky lg:top-32">
            <h2 className="font-display text-2xl">Order Summary</h2>
            {[...subtotals].map(([currency, sum]) => (
              <dl key={currency} className="mt-6 flex items-center justify-between text-lg">
                <dt>Subtotal</dt>
                <dd className="font-medium">{money(sum, currency)}</dd>
              </dl>
            ))}
            {mixedCurrencies && <p role="alert" className="mt-4 text-sm text-gold-bright">These books are priced in different currencies and cannot be bought together. Remove one to continue.</p>}
            <Link
              href="/checkout"
              aria-disabled={mixedCurrencies || opening}
              aria-busy={opening}
              onClick={(e) => {
                if (mixedCurrencies || opening) return e.preventDefault();
                setOpening(true);
              }}
              className="mt-8 block rounded-[40px] bg-white py-3 text-center text-lg font-medium text-black transition-colors hover:bg-gold-bright aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
            >
              {opening ? "Opening checkout..." : "Proceed to Checkout"}
            </Link>
            <Link href="/store" className="mt-4 block text-center text-sm underline underline-offset-4 hover:text-gold-bright">
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
