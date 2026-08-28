/**
 * Small inline SVG icons used by the UI primitives.
 *
 * No icon library is installed in this project (see package.json) — these
 * are hand-rolled to avoid adding a dependency for a handful of glyphs.
 * Icons are presentational only: they carry `aria-hidden` and inherit
 * `currentColor` so callers control color via text-* classes.
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function StarIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M10 1.5l2.59 5.25 5.79.84-4.19 4.09.99 5.77L10 14.77l-5.18 2.68.99-5.77L1.62 7.59l5.79-.84L10 1.5z" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
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
      <path d="M5 7.5l5 5 5-5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 10.5l3.5 3.5L16 6" />
    </svg>
  );
}

export function SpinnerIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="animate-spin"
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity={0.25}
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function GoogleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.46 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.61l4 3.11C6.22 6.88 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

export function AppleIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M16.36 1.5c.12 1.05-.29 2.08-.94 2.85-.67.78-1.76 1.4-2.83 1.31-.14-1.02.36-2.09.98-2.83.71-.83 1.9-1.44 2.79-1.33zM20.6 17.16c-.32.75-.7 1.44-1.15 2.08-.62.9-1.13 1.52-1.53 1.87-.62.58-1.28.88-1.99.9-.51.01-1.12-.14-1.83-.45-.71-.31-1.36-.46-1.96-.46-.62 0-1.29.15-2.02.46-.73.31-1.32.47-1.77.49-.68.03-1.36-.28-2.02-.92-.43-.38-.97-1.03-1.61-1.95-.69-.98-1.26-2.13-1.71-3.44-.48-1.42-.72-2.79-.72-4.12 0-1.52.33-2.83.98-3.93a5.78 5.78 0 0 1 2.05-2.08 5.5 5.5 0 0 1 2.77-.79c.55 0 1.28.17 2.18.51.9.34 1.48.51 1.73.51.19 0 .83-.2 1.9-.6.02-.01 1.85-.63 2.61.28.55.66.86 1.48.9 2.44-1.85 1.08-2.77 2.6-2.75 4.55.01 1.51.56 2.77 1.66 3.76.49.44.85.77 1.19 1.29z" />
    </svg>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="#1877F2" aria-hidden="true" {...props}>
      <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
    </svg>
  );
}
