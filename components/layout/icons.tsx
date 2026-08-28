/**
 * Small inline SVG icons used only by `components/layout/*`.
 *
 * Same convention as `components/ui/icons.tsx` (hand-rolled, no icon
 * library dependency, `aria-hidden`, inherits `currentColor`) but kept
 * separate since these are nav/player glyphs rather than form-kit glyphs.
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

export function MenuIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function CartIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.6h7.2a2 2 0 0 0 2-1.6L20 8H6" />
      <circle cx="9.5" cy="20" r="1.25" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 3.4 1 5 1.5 5.5H4.5C5 14 6 12.4 6 9Z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13Z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z" />
    </svg>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h12v17l-6-4-6 4v-17Z" />
    </svg>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12h4l2.5 7L14 5l2.5 7H21" />
    </svg>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-1 1.47V21a2 2 0 1 1-4 0v-.09a1.6 1.6 0 0 0-1-1.47 1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.6 1.6 0 0 0 .32-1.76 1.6 1.6 0 0 0-1.47-1H3a2 2 0 1 1 0-4h.09a1.6 1.6 0 0 0 1.47-1 1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.76.32H9a1.6 1.6 0 0 0 1-1.47V3a2 2 0 1 1 4 0v.09a1.6 1.6 0 0 0 1 1.47 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.76V9a1.6 1.6 0 0 0 1.47 1H21a2 2 0 1 1 0 4h-.09a1.6 1.6 0 0 0-1.47 1Z" />
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" />
    </svg>
  );
}

export function SkipBackIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6 5 12l7 6V6Z" fill="currentColor" stroke="none" />
      <path d="M19 6v12" />
      <text
        x="9"
        y="15.5"
        fontSize="6.5"
        fontWeight="700"
        stroke="none"
        fill="currentColor"
      >
        30
      </text>
    </svg>
  );
}

export function SkipForwardIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6l7 6-7 6V6Z" fill="currentColor" stroke="none" />
      <path d="M5 6v12" />
      <text
        x="8.5"
        y="15.5"
        fontSize="6.5"
        fontWeight="700"
        stroke="none"
        fill="currentColor"
      >
        30
      </text>
    </svg>
  );
}
