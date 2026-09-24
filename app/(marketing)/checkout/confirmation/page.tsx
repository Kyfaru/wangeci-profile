"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@/components/cart/icons";
import { Button, Card } from "@/components/ui";
import { useCartStore } from "@/lib/stores/cart-store";

/**
 * `/checkout/confirmation` — mock order-success page.
 *
 * No real order/payment backend exists yet (this whole flow is
 * frontend-only per the plan's scope for this build step), so the order id
 * is a client-generated placeholder rather than something returned by a
 * server. The cart is cleared on mount so a refresh of `/cart` afterward
 * correctly shows the empty state.
 */
export default function CheckoutConfirmationPage() {
  const router = useRouter();
  const clear = useCartStore((state) => state.clear);
  const [orderId] = useState(
    () => `ORD-${Date.now().toString(36).toUpperCase()}`,
  );

  useEffect(() => {
    clear();
    // Runs once on mount only — `clear` is a stable Zustand action
    // reference, and re-running this on every render would be wrong even if
    // it weren't.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <Card
        padding="lg"
        className="flex w-full max-w-md flex-col items-center gap-5 text-center"
      >
        <span className="flex size-16 items-center justify-center rounded-full bg-green/10 text-green">
          <CheckCircleIcon className="size-9" />
        </span>

        <h1 className="font-display text-2xl text-navy">
          Thank you for your order
        </h1>
        <p className="text-gray">
          Your payment was received and your order is confirmed. A receipt
          and your ebook access details will be sent to your email shortly.
        </p>

        <p className="rounded-full bg-gray-light px-4 py-1.5 text-sm font-medium text-navy">
          Order ID: {orderId}
        </p>

        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/store")}
          >
            Back to Store
          </Button>
          <Button className="flex-1" onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </Button>
        </div>
      </Card>
    </div>
  );
}
