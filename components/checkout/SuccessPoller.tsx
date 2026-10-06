"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useCartStore } from "@/lib/stores/cart-store";

interface OrderView {
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "EXPIRED";
  provider: "PAYSTACK" | "MPESA" | null;
  total: number;
  currency: string;
  items: { title: string }[];
}

const GIVE_UP_AFTER_MS = 5 * 60_000;

/** Polls the order (with growing waits) until the server reports a final status. */
export function SuccessPoller({ reference }: { reference: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [missing, setMissing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const clearCart = useCartStore((s) => s.clear);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let delay = 2500;
    const startedAt = Date.now();

    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(reference)}`, { cache: "no-store" });
        if (res.status === 404) return !cancelled && setMissing(true);
        if (res.ok) {
          const data = (await res.json()) as OrderView;
          if (cancelled) return;
          setOrder(data);
          if (data.status !== "PENDING") {
            if (data.status === "PAID") clearCart();
            return; // final: stop polling
          }
        }
      } catch {
        /* network blip: try again */
      }
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) return !cancelled && setTimedOut(true);
      delay = Math.min(delay * 1.4, 10_000);
      if (!cancelled) setTimeout(tick, delay);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [reference, clearCart]);

  const box = "mx-auto min-h-[60vh] max-w-[560px] px-6 pb-24 pt-32 text-center text-navy md:pt-40";

  if (!reference || missing) {
    return (
      <div className={box}>
        <h1 className="font-display text-3xl">We could not find that order</h1>
        <Link href="/store" className="mt-6 inline-block underline">
          Back to the store
        </Link>
      </div>
    );
  }

  if (order?.status === "PAID") {
    return (
      <div className={box} role="status">
        <h1 className="font-display text-4xl text-green">Payment received</h1>
        <p className="mt-3 text-lg text-navy/70">{order.items.map((i) => i.title).join(", ")} is now in My Books.</p>
        <Link href="/dashboard/books" className="mt-8 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
          Go to My Books
        </Link>
      </div>
    );
  }

  if (order?.status === "FAILED" || order?.status === "EXPIRED") {
    return (
      <div className={box} role="status">
        <h1 className="font-display text-3xl">The payment did not go through</h1>
        <p className="mt-3 text-navy/70">You have not been charged for this order. You can try again.</p>
        <Link href="/cart" className="mt-8 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
          Back to cart
        </Link>
      </div>
    );
  }

  if (order?.status === "REFUNDED") {
    return (
      <div className={box} role="status">
        <h1 className="font-display text-3xl">This order was refunded</h1>
      </div>
    );
  }

  return (
    <div className={box} role="status" aria-live="polite">
      <h1 className="font-display text-3xl">{timedOut ? "Still waiting for confirmation" : "Confirming your payment..."}</h1>
      <p className="mt-3 text-navy/70">
        {order?.provider === "MPESA"
          ? "Check your phone and enter your M-Pesa PIN. This page updates by itself."
          : "This usually takes a few seconds. This page updates by itself."}
      </p>
      {timedOut && (
        <p className="mt-4 text-navy/70">
          If you were charged, your book will appear in My Books shortly. If it does not, <Link href="/contact" className="underline">contact us</Link> with this reference: {reference}.
        </p>
      )}
    </div>
  );
}
