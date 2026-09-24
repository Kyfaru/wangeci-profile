/**
 * Small inline SVG icons scoped to `components/marketing/*` and its pages
 * (`/services`, `/blog`). Mirrors the conventions in
 * `components/ui/icons.tsx` (currentColor, aria-hidden, no icon library)
 * but lives here rather than in `components/ui/**`, which is a read-only
 * surface for this task.
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

export function MicIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3M9 21h6" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5 13 13l-4.5 2.5L11 11l4.5-2.5Z" />
    </svg>
  );
}

export function HandshakeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 11.5 6.5 7l3 2 2.5-2 3 2.5 4-3" />
      <path d="M9.5 9 13 12.5l-1.5 1.5a1.6 1.6 0 0 1-2.26 0v0" />
      <path d="M13 12.5l1.5 1.5" />
      <path d="M22 12l-3.5 4-3-2.5" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 6.2a3.25 3.25 0 0 1 0 6.1" />
      <path d="M17.5 14.2a5.5 5.5 0 0 1 3 5.3" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v3.5M16 3v3.5" />
    </svg>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="18" cy="5.5" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="18.5" r="2.25" />
      <path d="M7.9 10.9 16.1 6.6M7.9 13.1l8.2 4.3" />
    </svg>
  );
}
