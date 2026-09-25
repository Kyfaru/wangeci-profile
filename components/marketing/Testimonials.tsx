"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AppIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { TESTIMONIALS } from "@/lib/content/landing";

const AUTO_MS = 5000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Book testimonials — editorial layout, auto-advances every 5s (pauses on hover/focus). */
export function Testimonials() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const total = TESTIMONIALS.length;
  const t = TESTIMONIALS[active];

  // Keyed on `active`, so a manual change restarts the 5s clock.
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(() => setActive((a) => (a + 1) % total), AUTO_MS);
    return () => clearTimeout(id);
  }, [active, paused, total]);

  const go = (i: number) => setActive((i + total) % total);

  return (
    <section
      className="bg-cream px-6 py-20 lg:py-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="mx-auto w-full max-w-2xl">
        <p className="mb-8 text-sm font-medium uppercase tracking-[0.25em] text-gold">
          Readers on From Pieces To Power
        </p>

        <div className="flex items-start gap-6 md:gap-8">
          <span
            aria-hidden
            className="select-none text-[72px] font-light leading-none text-navy/10 md:text-[120px]"
            style={{ fontFeatureSettings: '"tnum"' }}
          >
            {pad(active + 1)}
          </span>

          <div className="min-h-[250px] flex-1 pt-3 md:pt-6" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.figure
                key={active}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3 }}
              >
                <blockquote className="text-2xl font-light leading-relaxed tracking-tight text-navy md:text-3xl">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-10 flex items-center gap-4">
                  <span className="grid size-12 place-items-center rounded-full bg-navy text-sm font-medium text-cream ring-2 ring-navy/10">
                    {t.author.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <span>
                    <span className="block font-medium text-navy">{t.author}</span>
                    <span className="block text-sm text-gray">
                      {t.role}
                      <span className="mx-2 text-navy/20">/</span>
                      {t.place}
                    </span>
                  </span>
                </figcaption>
              </motion.figure>
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              {TESTIMONIALS.map((item, i) => (
                <button
                  key={item.author}
                  type="button"
                  aria-label={`Show testimonial ${i + 1}`}
                  aria-current={i === active}
                  onClick={() => go(i)}
                  className="group py-4"
                >
                  <span
                    className={cn(
                      "block h-px transition-all duration-500 ease-out",
                      i === active
                        ? "w-12 bg-navy"
                        : "w-6 bg-navy/20 group-hover:w-8 group-hover:bg-navy/40",
                    )}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs uppercase tracking-widest text-gray">
              {pad(active + 1)} / {pad(total)}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {(["prev", "next"] as const).map((dir) => (
              <button
                key={dir}
                type="button"
                aria-label={dir === "prev" ? "Previous testimonial" : "Next testimonial"}
                onClick={() => go(active + (dir === "prev" ? -1 : 1))}
                className="rounded-full p-2 text-navy/40 transition-all duration-300 hover:bg-navy/5 hover:text-navy"
              >
                <AppIcon icon={dir === "prev" ? "lucide:chevron-left" : "lucide:chevron-right"} size={20} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
