"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useInView } from "motion/react";
import { AppIcon } from "@/lib/icons";
import { BUSINESSES } from "@/lib/content/landing";

const STEP = 9.75; // % of the stack width each card sits behind the one in front (54px of 554px)
const FRONT_LEFT = 19.5; // front card's left edge, %
const HINT_DELAY_MS = 3000; // dwell before the first hint, and pause between hints
const HINT_SHOW_MS = 1800;

const left = (depth: number) => `${FRONT_LEFT - STEP * depth}%`;
const z = (depth: number) => 30 - depth * 10;

/**
 * Businesses as a stack of book-like cards. Only the user moves them:
 * click the top card and it slides out and goes to the back. The right-hand
 * text follows the front card. Until the first click, a "Click me" hint
 * appears on the top card after 3s, hides, waits 3s, and repeats.
 */
export function BusinessStack() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { amount: 0.5 });
  const [order, setOrder] = useState<number[]>(() => BUSINESSES.map((_, i) => i));
  const [moved, setMoved] = useState<number | null>(null);
  const [clicked, setClicked] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!inView || clicked) return;
    let t: ReturnType<typeof setTimeout>;
    const show = () => {
      setHint(true);
      t = setTimeout(hide, HINT_SHOW_MS);
    };
    const hide = () => {
      setHint(false);
      t = setTimeout(show, HINT_DELAY_MS);
    };
    t = setTimeout(show, HINT_DELAY_MS);
    return () => {
      clearTimeout(t);
      setHint(false); // left the section or clicked: hide, and restart the 3s dwell next time
    };
  }, [inView, clicked]);

  const advance = () => {
    setClicked(true);
    setMoved(order[0]);
    setOrder([...order.slice(1), order[0]]);
  };

  const frontIdx = order[0];
  const front = BUSINESSES[frontIdx];

  return (
    <section
      ref={ref}
      className="bg-gray-light py-8 lg:grid lg:grid-cols-[minmax(0,554px)_1fr] lg:items-start"
    >
      {/* Stack */}
      <div className="relative mx-auto aspect-[554/648] w-full max-w-[554px]">
        {BUSINESSES.map((b, idx) => {
          const depth = order.indexOf(idx);
          const isFront = depth === 0;
          const wentBack = moved === idx;
          return (
            <motion.button
              key={b.name}
              type="button"
              onClick={isFront ? advance : undefined}
              tabIndex={isFront ? 0 : -1}
              aria-hidden={!isFront}
              aria-label={isFront ? `${b.name} — show next business` : undefined}
              initial={false}
              animate={
                wentBack
                  ? {
                      // out to the right, drop behind the stack, slide home
                      left: [null, "70%", "70%", left(depth)],
                      zIndex: [null, 30, z(depth), z(depth)],
                    }
                  : { left: left(depth), zIndex: z(depth) }
              }
              transition={
                wentBack
                  ? { duration: 1, times: [0, 0.45, 0.5, 1], ease: "easeInOut" }
                  : { type: "spring", stiffness: 170, damping: 22 }
              }
              className={`absolute top-0 h-full w-[80.5%] overflow-hidden shadow-[-14px_0_28px_-6px_rgb(0_0_0/0.4),0_18px_24px_-12px_rgb(0_0_0/0.35)] ${isFront ? "cursor-pointer" : "cursor-default"}`}
            >
              <Image
                src={b.image}
                alt={b.alt}
                fill
                sizes="(min-width: 1024px) 36vw, 80vw"
                style={{ objectPosition: idx === 0 ? "50% 50%" : "0% 50%" }}
                className="object-cover"
              />
            </motion.button>
          );
        })}

        <AnimatePresence>
          {hint && (
            <motion.span
              aria-hidden
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.35 }}
              className="pointer-events-none absolute left-[59.75%] top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-navy/85 px-5 py-2.5 text-lg font-medium text-gold backdrop-blur-sm"
            >
              <span className="neon-loop flex items-center gap-2">
                <AppIcon icon="lucide:mouse-pointer-click" size={20} />
                Click me
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Text follows the front card */}
      <div className="px-6 pt-10 lg:px-[38px] lg:pt-10">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="text-center text-[clamp(2.25rem,5.2vw,5rem)] font-light leading-[1.1] tracking-[0.05em] text-black"
        >
          What she’s building
        </motion.h2>

        <AnimatePresence mode="wait">
          <motion.div
            key={frontIdx}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 lg:gap-x-[3.5vw]"
          >
            <span className="text-[clamp(3.5rem,6.67vw,6rem)] font-medium leading-none text-gold">
              {frontIdx + 1}.
            </span>
            <div className="pt-6 lg:pt-[2.6rem]">
              <h3 className="text-[clamp(2rem,5vw,4.5rem)] font-medium leading-[1.1] text-green">
                {front.name}
              </h3>
              <p className="mt-3 max-w-[706px] text-[clamp(1rem,2.22vw,2rem)] font-light leading-[1.387] text-gray">
                {front.description}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
