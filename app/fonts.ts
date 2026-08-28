/**
 * Local font definitions for the Wangeci Kariuki author/entrepreneur platform.
 *
 * - `aeonik`         — body/UI copy font. Loaded as a 4-weight family
 *                       (Light/Regular/Medium/Bold) from local .ttf files.
 * - `wayfindingSans`  — display/headline font. Single weight, used for
 *                       hero copy, section headings, and large statements.
 *
 * Both fonts expose CSS custom properties (`variable`) that are wired into
 * the Tailwind `@theme` block in `app/globals.css` as `--font-body` /
 * `--font-display`, and applied to `<html>` in `app/layout.tsx`.
 *
 * Font files live in `public/font/` (untracked in git — do not move them).
 * See AGENTS.md for why this project's Next.js docs must be consulted
 * before touching font/config code.
 */
import localFont from "next/font/local";

export const aeonik = localFont({
  src: [
    {
      path: "../public/font/aeonik-font/Aeonik-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/font/aeonik-font/Aeonik-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/font/aeonik-font/Aeonik-Medium.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/font/aeonik-font/Aeonik-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-aeonik",
  display: "swap",
});

export const wayfindingSans = localFont({
  // Only one weight ships for this face — the smallest available format
  // (woff2, from the "Web Fonts" export) is used for best load performance.
  src: "../public/font/Wayfinding Sans/Wayfinding Sans ExN/Web Fonts/8efc0cef8694616d4d29b1e61cf0f74c.woff2",
  variable: "--font-wayfinding-sans",
  display: "swap",
  weight: "400",
});
