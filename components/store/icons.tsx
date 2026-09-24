/**
 * Small inline SVG icons scoped to the store/book-preview pages.
 *
 * Mirrors the conventions in `components/ui/icons.tsx` (currentColor,
 * aria-hidden, no icon library) but lives here rather than in
 * `components/ui/**`, which is a read-only surface for this task.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Matches the Figma "carbon--time-filled" glyph used on the duration pill. */
export function ClockIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16 2C8.4 2 2 8.4 2 16s6.4 14 14 14s14-6.4 14-14S23.6 2 16 2m4.587 20L15 16.41V7h2v8.582l5 5.004z" />
    </svg>
  );
}

/** Matches the Figma "basil--shopping-bag-solid" glyph used on the Buy Book Now button. */
export function ShoppingBagIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.25 7.13v.37H5.749a.9.9 0 0 0-.892.77L4.64 9.763a30.3 30.3 0 0 0 0 8.79a2.885 2.885 0 0 0 2.557 2.451l.629.066c2.776.288 5.574.288 8.35 0l.63-.066a2.885 2.885 0 0 0 2.556-2.451a30.3 30.3 0 0 0 0-8.79l-.218-1.493a.9.9 0 0 0-.892-.77H16.75v-.37a4.75 4.75 0 1 0-9.5 0m5.56-3.147A3.25 3.25 0 0 0 8.75 7.13v.37h6.5v-.37a3.25 3.25 0 0 0-2.44-3.147M8.75 9a.75.75 0 0 0-1.5 0v2a.75.75 0 0 0 1.5 0zm8 0a.75.75 0 0 0-1.5 0v2a.75.75 0 0 0 1.5 0z"
      />
    </svg>
  );
}
