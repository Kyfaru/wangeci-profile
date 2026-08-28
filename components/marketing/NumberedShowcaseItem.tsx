import Image from "next/image";
import { cn } from "@/lib/cn";

export interface NumberedShowcaseItemProps {
  /** e.g. "1." — kept as a string so callers control the exact glyph. */
  number: string;
  name: string;
  description: string;
  /** Optional photo. Omit to render the placeholder fill. */
  imageSrc?: string;
  className?: string;
}

/**
 * One entry in the "What she's building" showcase list — a big index
 * numeral, a photo, and a name/description pair. Reusable: the Home page
 * renders one entry now (Fechi Organics), later pages can render more from
 * `lib/mock-businesses.ts` without change.
 */
export function NumberedShowcaseItem({
  number,
  name,
  description,
  imageSrc,
  className,
}: NumberedShowcaseItemProps) {
  return (
    <div
      className={cn(
        "grid gap-6 sm:grid-cols-[auto_1fr] sm:gap-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-12",
        className,
      )}
    >
      <span className="font-display text-5xl leading-none text-navy/15 sm:text-6xl lg:text-7xl">
        {number}
      </span>

      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-navy/10 sm:col-start-2 lg:col-start-2">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={name}
            fill
            sizes="(min-width: 1024px) 33vw, 100vw"
            className="object-cover"
          />
        ) : (
          // Placeholder fill — no business photography exported from Figma
          // yet.
          <div className="absolute inset-0 bg-gradient-to-br from-navy/20 to-navy/5" />
        )}
      </div>

      <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-1 lg:col-start-3">
        <h3 className="font-display text-2xl text-green sm:text-3xl">
          {name}
        </h3>
        <p className="max-w-md text-base leading-relaxed text-gray">
          {description}
        </p>
      </div>
    </div>
  );
}
