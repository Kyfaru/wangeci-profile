/**
 * Small inline SVG icons scoped to `components/dashboard/**` and
 * `app/(dashboard)/**`.
 *
 * Same hand-rolled convention as `components/ui/icons.tsx` /
 * `components/store/icons.tsx` (currentColor, aria-hidden, no icon library)
 * but lives here since `components/ui/**` is a read-only surface for this
 * task and these glyphs (eye/headphone/reply/streak/trophy) don't exist
 * anywhere else in the codebase yet.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/** Views stat chip. */
export function EyeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M1.5 10S4.5 4.5 10 4.5 18.5 10 18.5 10 15.5 15.5 10 15.5 1.5 10 1.5 10Z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}

/** Listening / audiobook stat chip. */
export function HeadphoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 11v-1a7 7 0 0 1 14 0v1" />
      <rect x="2" y="11" width="4" height="5.5" rx="1.5" />
      <rect x="14" y="11" width="4" height="5.5" rx="1.5" />
    </svg>
  );
}

/** "Reply" notification type. */
export function MessageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 4.5h15v9h-8L5 16.5v-3h-2.5v-9Z" />
    </svg>
  );
}

/** Reading/listening streak stat. */
export function FlameIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 1.75s4 3.5 4 7.75a4 4 0 1 1-8 0c0-1 .4-1.8.9-2.5.2.9.9 1.4 1.5 1.1-.4-2 .6-4.1 1.6-6.35Z" />
    </svg>
  );
}

/** Books-completed stat. */
export function TrophyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h8v4a4 4 0 0 1-8 0v-4Z" />
      <path d="M6 4.5H3.5a1 1 0 0 0-1 1v.5a3 3 0 0 0 3 3M14 4.5h2.5a1 1 0 0 1 1 1v.5a3 3 0 0 1-3 3" />
      <path d="M10 11.5v2.5M7.5 16.5h5M8.5 14h3l.5 2.5h-4l.5-2.5Z" />
    </svg>
  );
}
