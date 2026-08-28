/**
 * Small inline SVG icons scoped to the store/book-preview pages.
 *
 * Mirrors the conventions in `components/ui/icons.tsx` (currentColor,
 * aria-hidden, no icon library) but lives here rather than in
 * `components/ui/**`, which is a read-only surface for this task.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function ClockIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 5.5V10l3 2" />
    </svg>
  );
}

export function ShoppingBagIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M5 7.5h10l-.7 9.1a1.5 1.5 0 0 1-1.5 1.4H7.2a1.5 1.5 0 0 1-1.5-1.4L5 7.5z" />
      <path d="M7 7.5V6a3 3 0 0 1 6 0v1.5" />
    </svg>
  );
}
