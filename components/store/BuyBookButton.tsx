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
import { SpinnerIcon } from "@/components/ui";
import { cn } from "@/lib/cn";
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
      {/*
        White pill per the Figma "Book Preview" frame — deliberately not
        `components/ui/Button` (whose variants are navy/gold, not white on
        black) since that primitive is a read-only surface for this task.
      */}
      <button
        type="button"
        disabled={isPending}
        aria-busy={isPending || undefined}
        onClick={handleClick}
        className={cn(
          "inline-flex h-16 items-center justify-center gap-3 rounded-full bg-white px-8 text-lg font-medium text-black transition-colors duration-150 hover:bg-white/90 active:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-bright focus-visible:ring-offset-2 focus-visible:ring-offset-navy",
          "sm:h-[72px] sm:px-9 sm:text-xl",
        )}
      >
        {isPending ? (
          <SpinnerIcon className="size-6" />
        ) : (
          <ShoppingBagIcon className="size-6 sm:size-7" />
        )}
        Buy Book Now
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-error">
          {error}
        </p>
      )}
    </div>
  );
}
