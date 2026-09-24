"use client";

import { useRouter } from "next/navigation";
import { CartItemRow } from "@/components/cart/CartItemRow";
import { OrderSummary } from "@/components/cart/OrderSummary";
import { Button, SectionHeading } from "@/components/ui";
import { useCartStore } from "@/lib/stores/cart-store";

/**
 * `/cart` — reads live cart state from `useCartStore` (Zustand,
 * localStorage-persisted, populated by `BuyBookButton`'s
 * `POST /api/cart/add` flow). Not in the Figma file; built to this
 * project's shared design tokens like `/store`.
 */
export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-5 px-6 py-24 text-center lg:px-12">
        <h1 className="font-display text-3xl text-navy">
          Your cart is empty
        </h1>
        <p className="max-w-md text-gray">
          Looks like you haven&apos;t added anything yet. Browse the store to
          find your next read.
        </p>
        <Button onClick={() => router.push("/store")}>
          Browse the store
        </Button>
      </div>
    );
  }

  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-16 lg:px-12">
      <SectionHeading
        eyebrow="Cart"
        description={`${itemCount} item${itemCount === 1 ? "" : "s"} ready for checkout.`}
      >
        Your Cart
      </SectionHeading>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <CartItemRow key={item.id} item={item} />
          ))}
        </div>

        <OrderSummary
          lines={items.map((item) => ({
            id: item.id,
            title: item.title,
            qty: item.qty,
            price: item.price,
          }))}
          currency={items[0]?.currency ?? "KES"}
          footer={
            <Button
              className="w-full"
              size="lg"
              onClick={() => router.push("/checkout")}
            >
              Proceed to Checkout
            </Button>
          }
        />
      </div>
    </div>
  );
}
