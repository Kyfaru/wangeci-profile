import Image from "next/image";
import { cn } from "@/lib/cn";

export interface PortraitCollagePanel {
  /** Overlay label, e.g. "AUTHOR" or "mother" — casing is rendered as-is. */
  label: string;
  /** Optional photo. Omit to render the navy placeholder fill. */
  imageSrc?: string;
}

export interface PortraitCollageProps {
  panels: PortraitCollagePanel[];
  className?: string;
}

/**
 * Horizontal row of framed portrait panels, each carrying a large rotated
 * label overlay (per the Figma "About Me" collage). Generic/reusable by
 * design — the marketing Home page and the `/about` page both render this
 * with different panel sets, so it only ever takes `panels` + styling.
 *
 * Label casing is intentionally preserved verbatim (no `uppercase` text
 * transform) — the Figma design mixes "AUTHOR" with "mother"/"Wife", and
 * that mixed casing is part of the design, not an oversight.
 */
export function PortraitCollage({ panels, className }: PortraitCollageProps) {
  return (
    <div
      className={cn(
        "flex w-full snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:gap-4",
        className,
      )}
    >
      {panels.map((panel, index) => (
        <div
          key={`${panel.label}-${index}`}
          className="relative aspect-[3/4] w-[62vw] shrink-0 snap-start overflow-hidden rounded-card bg-navy sm:w-[220px] lg:w-full lg:flex-1"
        >
          {panel.imageSrc ? (
            <Image
              src={panel.imageSrc}
              alt={panel.label}
              fill
              sizes="(min-width: 1024px) 20vw, 60vw"
              className="object-cover"
            />
          ) : (
            // Placeholder fill — no portrait photography has been exported
            // from Figma yet. Solid navy gradient stands in for the photo.
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(165deg, var(--color-navy) 0%, #081527 100%)",
              }}
            />
          )}

          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="origin-center -rotate-90 font-display text-2xl whitespace-nowrap text-gold-bright sm:text-3xl">
              {panel.label}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
