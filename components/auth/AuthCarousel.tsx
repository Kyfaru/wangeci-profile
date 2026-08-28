"use client";

/**
 * Auto-advancing, cross-fading image carousel for the login page's right
 * column (full-bleed, no padding/radius, `object-fit: cover` equivalent).
 *
 * No real photography has been exported from Figma yet (see the plan's
 * §8 note on missing assets), so each "slide" below is a clearly-labeled
 * placeholder `div` — a soft navy/gold gradient standing in for a portrait
 * or lifestyle photo — rather than an invented external image URL. Swap
 * each placeholder's contents for a real `<img>`/`next/image` once
 * photography exists; the fade/timing/dots logic doesn't need to change.
 *
 * Cross-fade only (never slide): every slide is stacked with
 * `position: absolute; inset: 0`, and only `opacity` + `transition`
 * differ between the active and inactive slides.
 *
 * The base column gradient and its dot-grid texture are painted by the
 * caller (`app/(auth)/login/page.tsx`) *behind* this component, per the
 * spec's layer order ("bottom layer: dot-grid ... [then] carousel") —
 * this component only owns the slides, the dark legibility overlay, the
 * dots, and the caption.
 */
import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

const HOLD_MS = 5000;
const FADE_MS = 800;

// Placeholder image blocks — replace with real exported photography.
// Each entry is just a gradient + label standing in for a portrait/photo.
const PLACEHOLDER_SLIDES = [
  { id: 1, from: "#0C2142", to: "#1B3A66" },
  { id: 2, from: "#0F4FB1", to: "#0C2142" },
  { id: 3, from: "#16305C", to: "#0C2142" },
  { id: 4, from: "#0C2142", to: "#2A4A82" },
  { id: 5, from: "#123566", to: "#0C2142" },
] as const;

export function AuthCarousel() {
  const [index, setIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % PLACEHOLDER_SLIDES.length);
    }, HOLD_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Slides — cross-fade only, never slide/translate. */}
      {PLACEHOLDER_SLIDES.map((slide, i) => (
        <div
          key={slide.id}
          aria-hidden={i !== index}
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${slide.from} 0%, ${slide.to} 100%)`,
            opacity: i === index ? 1 : 0,
            transition: reducedMotion
              ? "none"
              : `opacity ${FADE_MS}ms ease-in-out`,
          }}
        />
      ))}

      {/* Dark gradient overlay so caption text stays legible over any slide. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(12,33,66,0.85) 0%, rgba(12,33,66,0.3) 40%, transparent 65%)",
        }}
      />

      {/* Dots */}
      <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2">
        {PLACEHOLDER_SLIDES.map((slide, i) => (
          <span
            key={slide.id}
            aria-hidden="true"
            className="rounded-full"
            style={{
              width: i === index ? 8 : 6,
              height: i === index ? 8 : 6,
              backgroundColor:
                i === index ? "var(--gold)" : "rgba(255,255,255,0.3)",
              transition: reducedMotion
                ? "none"
                : "width 200ms ease, height 200ms ease, background-color 200ms ease",
            }}
          />
        ))}
      </div>

      {/* Caption */}
      <div className="absolute bottom-12 left-12 max-w-xs">
        <p className="font-medium text-sm text-gold">
          Felister Wangechi Kariuki
        </p>
        <p className="mt-1 text-[13px] text-cream/80">
          Journalist. Entrepreneur. Author.
        </p>
      </div>
    </div>
  );
}
