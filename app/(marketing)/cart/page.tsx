"use client";

import Image from "next/image";
import Link from "next/link";
import { BOOK_HREF } from "@/lib/content/landing";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useCartStore } from "@/lib/stores/cart-store";

const money = (n: number, currency: string) => `${currency} ${n.toLocaleString("en-KE")}`;
const qtyBtn =
  "grid size-9 place-items-center rounded-full border border-navy/30 text-lg leading-none transition-colors hover:border-gold hover:text-gold";

/**
 * `/cart` — not in Figma; built from the project tokens. Reads the
 * localStorage-persisted `useCartStore`, so the body waits for hydration.
 */
export default function CartPage() {
  const hydrated = useHydrated();
  const { items, updateQty, removeItem } = useCartStore();
  const currency = items[0]?.currency ?? "KES";
  const subtotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  return (
    <div className="mx-auto min-h-[70vh] max-w-[1100px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Your Cart</h1>

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
                  <p className="text-navy/70">{money(item.price, item.currency)}</p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="mt-1 text-sm text-navy/60 underline underline-offset-4 hover:text-gold"
                  >
                    Remove
                  </button>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-6 sm:col-span-1 sm:flex-col sm:items-end sm:gap-3">
                  <div className="flex items-center gap-3">
                    <button type="button" aria-label={`Decrease quantity of ${item.title}`} onClick={() => updateQty(item.id, item.qty - 1)} className={qtyBtn}>
                      −
                    </button>
                    <span className="w-6 text-center text-lg" aria-live="polite">
                      {item.qty}
                    </span>
                    <button type="button" aria-label={`Increase quantity of ${item.title}`} onClick={() => updateQty(item.id, item.qty + 1)} className={qtyBtn}>
                      +
                    </button>
                  </div>
                  <p className="text-lg font-medium text-navy">{money(item.qty * item.price, item.currency)}</p>
                </div>
              </li>
            ))}
          </ul>

          <aside className="rounded-[30px] bg-navy p-8 text-cream lg:sticky lg:top-32">
            <h2 className="font-display text-2xl">Order Summary</h2>
            <dl className="mt-6 flex items-center justify-between text-lg">
              <dt>Subtotal</dt>
              <dd className="font-medium">{money(subtotal, currency)}</dd>
            </dl>
            {/* TODO: /checkout is not built yet. */}
            <Link
              href="/checkout"
              className="mt-8 block rounded-[40px] bg-white py-3 text-center text-lg font-medium text-black transition-colors hover:bg-gold-bright"
            >
              Proceed to Checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
