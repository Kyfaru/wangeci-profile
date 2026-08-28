"use client";

/**
 * "Buy Book Now" CTA for the Book Preview page.
 *
 * Calls the mock `POST /api/cart/add` endpoint (see
 * `app/api/cart/add/route.ts`), which validates the book and returns a
 * normalized cart line. That line is then pushed into `useCartStore`
 * (Zustand, localStorage-persisted — already built by a parallel workstream
 * at `lib/stores/cart-store.ts`) so the navbar cart badge and `/cart` page
 * update immediately, and finally the user is navigated to `/cart`.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { apiClient, ApiError } from "@/lib/api/client";
import { useCartStore, type CartItem } from "@/lib/stores/cart-store";
import { ShoppingBagIcon } from "./icons";

export interface BuyBookButtonProps {
  slug: string;
  editionId?: string;
  className?: string;
}

interface AddToCartResponse {
  success: boolean;
  item: CartItem;
}

export function BuyBookButton({
  slug,
  editionId,
  className,
}: BuyBookButtonProps) {
  const router = useRouter();
  const addItem = useCartStore((state) => state.addItem);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsPending(true);
    try {
      const res = await apiClient.post<AddToCartResponse>("/cart/add", {
        itemId: slug,
        type: "book",
        editionId,
      });
      addItem(res.item);
      router.push("/cart");
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Couldn't add this book to your cart. Please try again.";
      setError(message);
      // TODO(api): swap for real error reporting once cart writes hit a
      // real backend instead of the mock route.
      console.error("[store/[slug]] add-to-cart failed", err);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className={className}>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        icon={<ShoppingBagIcon className="size-5" />}
        loading={isPending}
        onClick={handleClick}
      >
        Buy Book Now
      </Button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
