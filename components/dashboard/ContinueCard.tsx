import Image from "next/image";
import Link from "next/link";

import { MaskIcon } from "@/components/ui/MaskIcon";

interface ContinueCardProps {
  href: string;
  title: string;
  author: string;
  cover: string;
  /** 0 to 100, from the saved reading or listening position. */
  progressPercent: number;
  /** The person's own bookmarks on this book (never popularity numbers). */
  bookmarkCount: number;
  format: "ebook" | "audiobook";
  /** Set on the first card in view: Next.js treats the visible cover as the LCP candidate. */
  priority?: boolean;
}

/** Book card with a progress bar (Figma: "My dashboard" frame). Shows real data only. */
export function ContinueCard({ href, title, author, cover, progressPercent, bookmarkCount, format, priority }: ContinueCardProps) {
  const pct = Math.round(progressPercent);
  return (
    <Link
      href={href}
      className="flex w-full max-w-[710px] flex-col items-center gap-6 rounded-[25px] border border-black p-6 transition-shadow hover:shadow-lg sm:h-[346px] sm:flex-row sm:gap-8 sm:px-8 sm:py-0"
    >
      <div className="relative aspect-[255/313] w-[200px] shrink-0 overflow-hidden rounded-[20px] sm:h-[313px] sm:w-[255px]">
        <Image src={cover} alt={`${title} cover`} fill sizes="255px" priority={priority} className="object-cover" />
      </div>
      <div className="min-w-0 flex-1 self-stretch text-center sm:self-center sm:text-left">
        <p className="line-clamp-2 font-display text-[28px] leading-tight text-black sm:text-[32px]">{title}</p>
        <p className="mt-1 font-medium text-gold/50">{author}</p>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-black sm:justify-start">
          <span className="flex items-center gap-1">
            <MaskIcon name={format === "ebook" ? "akar-icons--eye" : "fluent--headphones-sound-wave-48-filled"} size={15} />
            {format === "ebook" ? "Ebook" : "Audiobook"}
          </span>
          <span className="flex items-center gap-1" title="Your bookmarks">
            <MaskIcon name="basil--bookmark-outline" size={16} />
            {bookmarkCount}
          </span>
        </div>
        <div className="mt-8 sm:mt-9">
          <p className="font-display text-[15px] text-gold">{pct}%</p>
          <div className="mt-1 h-2 w-full max-w-[365px] rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${title} progress`}>
            <div className="h-2 rounded-full bg-gold-bright" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </Link>
  );
}
