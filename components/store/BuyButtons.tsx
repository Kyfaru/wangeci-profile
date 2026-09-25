"use client";

import { useRouter } from "next/navigation";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { useCartStore } from "@/lib/stores/cart-store";

interface BuyButtonsProps {
  slug: string;
  title: string;
  price: number;
  currency: string;
  cover: string;
  ebookEditionId?: string;
  audioEditionId?: string;
}

// Same gold spill-fill as "Get My Book" (.btn-fill), 0.5s slower: fill 1s (--fill-time), colours 0.7s.
// Sized in em off a font-size that follows the column width (cqw, capped at 24px), so height, padding,
// icon and gap scale together: 72px tall at full size, and nothing overflows on very small phones.
const pill =
  "btn-fill relative isolate inline-flex h-[3em] w-full sm:w-auto items-center justify-center gap-[0.67em] overflow-hidden rounded-full px-[1em] text-[clamp(17px,7.4cqw,24px)] font-medium transition-colors duration-700 ease-in [--fill-time:1s] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright";

/** Adds the chosen edition to the persisted cart, then goes to /cart. */
export function BuyButtons({ slug, title, price, currency, cover, ebookEditionId, audioEditionId }: BuyButtonsProps) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  function buy(editionId: string, format: string) {
    addItem({
      id: `book:${slug}:${editionId}`,
      itemId: slug,
      editionId,
      type: "book",
      title: `${title} (${format})`,
      price,
      currency,
      image: cover,
    });
    router.push("/cart");
  }

  return (
    <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
      {ebookEditionId && (
        <button
          type="button"
          onClick={() => buy(ebookEditionId, "Ebook")}
          className={`${pill} bg-white text-black hover:text-white`}
        >
          <MaskIcon name="basil--shopping-bag-solid" size="1.6em" />
          Buy Book Now
        </button>
      )}
      {audioEditionId && (
        <button
          type="button"
          onClick={() => buy(audioEditionId, "Audiobook")}
          className={`${pill} border-2 border-white text-white hover:border-gold`}
        >
          <MaskIcon name="fluent--headphones-sound-wave-48-filled" size="1.4em" />
          Buy Audiobook
        </button>
      )}
    </div>
  );
}
