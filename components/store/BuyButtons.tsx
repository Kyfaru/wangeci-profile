"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { MaskIcon } from "@/components/ui/MaskIcon";
import { useCartStore } from "@/lib/stores/cart-store";

interface BuyEdition {
  id: string;
  price: number;
  currency: string;
}

interface BuyButtonsProps {
  slug: string;
  title: string;
  cover: string;
  ebook?: BuyEdition;
  audio?: BuyEdition;
}

// Same gold spill-fill as "Get My Book" (.btn-fill), 0.5s slower: fill 1s (--fill-time), colours 0.7s.
// Sized in em off a font-size that follows the column width (cqw, capped at 24px), so height, padding,
// icon and gap scale together: 72px tall at full size, and nothing overflows on very small phones.
const pill =
  "btn-fill relative isolate inline-flex h-[3em] w-full sm:w-auto items-center justify-center gap-[0.67em] overflow-hidden rounded-full px-[1em] text-[clamp(17px,7.4cqw,24px)] font-medium transition-colors duration-700 ease-in [--fill-time:1s] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-bright";

const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-KE")}`;

/**
 * Buy buttons, one per edition, each with its own price. If the signed-in visitor already owns an
 * edition, its button becomes "Read now" / "Listen now". The cart is only a shopping list: the
 * server re-reads every price at checkout.
 */
export function BuyButtons({ slug, title, cover, ebook, audio }: BuyButtonsProps) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);
  const [owned, setOwned] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/user/owned", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { editionIds?: string[] }) => !cancelled && setOwned(d.editionIds ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function buy(edition: BuyEdition, format: string) {
    addItem({ id: `book:${slug}:${edition.id}`, itemId: slug, editionId: edition.id, type: "book", title: `${title} (${format})`, price: edition.price, currency: edition.currency, image: cover });
    router.push("/cart");
  }

  const ownsEbook = ebook && owned.includes(ebook.id);
  const ownsAudio = audio && owned.includes(audio.id);

  return (
    <div className="flex flex-wrap justify-center gap-3 lg:justify-start">
      {ebook &&
        (ownsEbook ? (
          <Link href={`/dashboard/books/${slug}/read`} className={`${pill} bg-white text-black hover:text-white`}>
            <MaskIcon name="basil--shopping-bag-solid" size="1.6em" />
            Read now
          </Link>
        ) : (
          <button type="button" onClick={() => buy(ebook, "Ebook")} className={`${pill} bg-white text-black hover:text-white`}>
            <MaskIcon name="basil--shopping-bag-solid" size="1.6em" />
            Buy Book Now · {money(ebook.price, ebook.currency)}
          </button>
        ))}
      {audio ? (
        ownsAudio ? (
          <Link href={`/dashboard/books/${slug}/listen`} className={`${pill} border-2 border-white text-white hover:border-gold`}>
            <MaskIcon name="fluent--headphones-sound-wave-48-filled" size="1.4em" />
            Listen now
          </Link>
        ) : (
          <button type="button" onClick={() => buy(audio, "Audiobook")} className={`${pill} border-2 border-white text-white hover:border-gold`}>
            <MaskIcon name="fluent--headphones-sound-wave-48-filled" size="1.4em" />
            Buy Audiobook · {money(audio.price, audio.currency)}
          </button>
        )
      ) : (
        // Never sell what we cannot deliver: no active audiobook edition means "coming soon".
        <span aria-disabled className="inline-flex h-[3em] w-full cursor-not-allowed items-center justify-center gap-[0.67em] rounded-full border-2 border-white/40 px-[1em] text-[clamp(17px,7.4cqw,24px)] font-medium text-white/60 sm:w-auto">
          <MaskIcon name="fluent--headphones-sound-wave-48-filled" size="1.4em" />
          Audiobook coming soon
        </span>
      )}
    </div>
  );
}
