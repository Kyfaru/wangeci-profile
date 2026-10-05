import Image from "next/image";
import Link from "next/link";
import { MaskIcon } from "@/components/ui/MaskIcon";

export function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

interface ContinueCardProps {
  slug: string;
  editionId: string;
  chapterIdx: number;
  title: string;
  author: string;
  cover: string;
  rating: number;
  /** Eye icon (reading) / headphone icon (listening) — no dedicated analytics field exists in the mock data, so this reuses `book.reviewCount` as a stand-in engagement number. */
  statIcon: string;
  statCount: number;
  bookmarkCount: number;
  progressPercent: number;
  variant: "reading" | "listening";
  /** Set on the first card in view — Next.js flags the visible cover as the LCP candidate. */
  priority?: boolean;
}

/** Book card with a progress bar (Figma: "My dashboard" frame, "Continue Reading"/"Continue Listening" rows). */
export function ContinueCard({
  slug,
  editionId,
  chapterIdx,
  title,
  author,
  cover,
  rating,
  statIcon,
  statCount,
  bookmarkCount,
  progressPercent,
  variant,
  priority,
}: ContinueCardProps) {
  const body = (
    <div className="flex h-[346px] w-[710px] max-w-full shrink-0 items-center gap-8 rounded-[25px] border border-black px-8">
      <div className="relative h-[313px] w-[255px] shrink-0 overflow-hidden rounded-[20px]">
        <Image src={cover} alt={`${title} cover`} fill sizes="255px" priority={priority} className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-display text-[32px] leading-tight text-black">{title}</p>
        <p className="mt-1 font-medium text-gold/50">{author}</p>
        <div className="mt-4 flex items-center gap-3 text-[10px] text-black">
          <span className="flex items-center gap-1 rounded-full bg-black/15 px-2 py-1">
            <MaskIcon name="ic--baseline-star-rate" size={13} className="text-gold-bright" />
            {rating}
          </span>
          <span className="flex items-center gap-1">
            <MaskIcon name={statIcon} size={15} />
            {formatCount(statCount)}
          </span>
          <span className="flex items-center gap-1">
            <MaskIcon name="basil--bookmark-outline" size={16} />
            {formatCount(bookmarkCount)}
          </span>
        </div>
        <div className="mt-9">
          <p className="text-[15px] font-display text-gold">{progressPercent}%</p>
          <div className="mt-1 h-2 w-full max-w-[365px] rounded-full bg-line">
            <div className="h-2 rounded-full bg-gold-bright" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );

  // "Continue Listening" has nowhere to send the reader yet (no player UI built — see lib/stores/player-store.ts),
  // so only the reading variant is a real link.
  if (variant === "listening") return body;

  return (
    <Link href={`/dashboard/books/${slug}/read?editionId=${editionId}&idx=${chapterIdx}`} className="block">
      {body}
    </Link>
  );
}
