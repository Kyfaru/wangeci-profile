import Link from "next/link";

/**
 * Branded 404. Renders under the root layout only (no `(marketing)` route
 * group match for an unknown path), so it doesn't get the Navbar/Footer —
 * it's a self-contained full-bleed page instead, reusing the homepage
 * hero's big rotated/display-font "wangeci" watermark treatment (see
 * `app/(marketing)/page.tsx`) for the "404" headline.
 *
 * `components/ui/Button` only renders a `<button>`, not an anchor (see the
 * same judgment call documented in `BookPromoBanner`), so the CTA below is
 * a `Link` styled to match `Button`'s "secondary" (gold) / "lg" variant
 * classes directly rather than nesting an `<a>` inside a `<button>`.
 */
export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-navy px-6 text-center text-cream">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg, var(--color-navy) 0%, #081527 100%)",
        }}
      />

      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 whitespace-nowrap select-none font-display text-[10rem] leading-none text-cream/5 sm:text-[16rem] lg:text-[22rem]"
      >
        wangeci
      </span>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <h1 className="font-display text-[6rem] leading-none text-gold sm:text-[9rem] lg:text-[11rem]">
          404
        </h1>
        <p className="max-w-md text-lg text-cream/80 sm:text-xl">
          This page took a wrong turn somewhere on the road to rebuilding.
        </p>
        <Link
          href="/"
          className="mt-2 inline-flex h-13 items-center justify-center rounded-full bg-gold px-8 text-lg font-medium tracking-tight text-navy transition-colors duration-150 hover:bg-gold-bright"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
