"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/cn";

/**
 * Distance from the viewport top; the active section is the last one whose top
 * has passed it. Just below the `scroll-mt-32` (128px) a clicked entry scrolls
 * to, so clicking an entry always makes that section the active one.
 */
const READING_LINE = 160;

/**
 * Sticky table of contents. The entry for the section being read turns gold
 * and grows ~1px (scaled, not resized, so wrapped titles never reflow the card).
 */
export function BookToc({ sections }: { sections: readonly { id: string; title: string }[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const reduceMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Stateless (position -> section) rather than an IntersectionObserver: jumps,
    // hash loads, restored scroll and the gap below the last section all resolve correctly.
    const update = () => {
      let current = sections[0]?.id;
      for (const { id } of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = id;
      }
      setActiveId(current);
    };
    const raf = requestAnimationFrame(update); // pick up a restored scroll position
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  return (
    <nav
      aria-label="Table of contents"
      className="hidden h-fit rounded-[22px] bg-[rgb(230_224_212/0.95)] px-6 py-6 md:block lg:sticky lg:top-28"
    >
      <h2 className="text-center font-display text-[22px] leading-[1.393] text-black">
        Table Of Content
      </h2>
      <ol className="mt-4 flex flex-col gap-3.5">
        {sections.map((s) => {
          const active = s.id === activeId;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={active ? "location" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  document
                    .getElementById(s.id)
                    ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
                  history.replaceState(null, "", `#${s.id}`);
                }}
                className={cn(
                  "block origin-left text-[18px] font-medium leading-[normal] transition-[color,transform] duration-300 motion-reduce:transition-none",
                  // w-[93%] x scale-[1.07] ≈ 100%, so the enlarged text can't spill out of the card.
                  active ? "w-[93%] scale-[1.07] text-gold" : "w-[93%] text-[#616161] hover:text-navy",
                )}
              >
                {s.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
