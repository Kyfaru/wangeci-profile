/**
 * Small inline SVG icons used only by `components/reader/*`.
 *
 * Same hand-rolled convention as `components/ui/icons.tsx` and
 * `components/layout/icons.tsx` — no icon library dependency, `aria-hidden`,
 * inherits `currentColor`.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function BookOpenIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.5c-1.6-1.3-3.7-2-6-2H4v13h2c2.3 0 4.4.7 6 2m0-13c1.6-1.3 3.7-2 6-2h2v13h-2c-2.3 0-4.4.7-6 2m0-13v13" />
    </svg>
  );
}

/** Vertical-dots "more options" glyph — no equivalent exists in the shared
 * `components/ui`/`components/layout` icon sets (those only have a
 * horizontal-bars `MenuIcon`), so it's added here. */
export function KebabIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
  );
}
