"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { HERO_ROLES } from "@/lib/content/landing";
import { cn } from "@/lib/cn";

const ROLE_INTERVAL_MS = 3200;
const vertical = "[writing-mode:vertical-rl] rotate-180 whitespace-nowrap";

/** Counts the year up/down to its new value; remounting retriggers the neon flicker. */
function NeonYear({ year }: { year: number }) {
  const value = useMotionValue(year);
  const text = useTransform(value, (v) => Math.round(v).toString());

  useEffect(() => {
    const controls = animate(value, year, { duration: 1.1, ease: "easeInOut" });
    return () => controls.stop();
  }, [value, year]);

  return (
    <motion.span key={year} className="neon inline-block text-gold">
      {text}
    </motion.span>
  );
}

/** Down arrow: two bobs, then rests `rest` seconds (same 2s + rest cycle as the shaft redraw, so they stay in step). */
function ScrollArrow({ rest, className }: { rest: number; className?: string }) {
  return (
    <motion.svg
      animate={{ y: [0, 10, 0, 10, 0] }}
      transition={{ duration: 2, ease: "easeInOut", repeat: Infinity, repeatDelay: rest }}
      viewBox="0 0 24 24"
      className={cn("size-7 text-gold", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Shaft draws in over the first 15% of a 2s loop (Figma motion data). */}
      <motion.path
        d="M12 3l0 17.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: [0, 1, 1, 1] }}
        transition={{ duration: 2, ease: "linear", times: [0, 0.15, 0.25, 1], repeat: Infinity, repeatDelay: rest }}
      />
      <path d="M12 21l7 -7M12 21l-7 -7" />
    </motion.svg>
  );
}

export function Hero() {
  const [i, setI] = useState(0);
  const role = HERO_ROLES[i];

  // Roles rotate every 3.2s; on mobile (< md) every 5.2s (2s longer). Re-checked each tick so resizing works.
  useEffect(() => {
    const delay = () =>
      window.matchMedia("(max-width: 767px)").matches ? ROLE_INTERVAL_MS + 2000 : ROLE_INTERVAL_MS;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setI((n) => (n + 1) % HERO_ROLES.length);
      t = setTimeout(tick, delay());
    };
    t = setTimeout(tick, delay());
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      id="hero"
      className="relative isolate flex h-svh min-h-[640px] items-start overflow-hidden bg-navy pt-28 text-cream sm:pt-40 wide:items-center wide:pt-0"
    >
      {/* Background: photo under a navy wash (Figma: photo at 10% on #0c2142). */}
      <Image
        src="/images/DSC09752.jpg.jpeg"
        alt=""
        fill
        preload
        sizes="100vw"
        className="object-cover object-top"
      />
      <div className="absolute inset-0 bg-navy/90" />

      {/* Giant outlined "wangeci", sized in vw so it crops like the design.
          Desktop: rotated -90° down the right side, BEHIND her (z-10), 55% stroke — as in Figma.
          Mobile: upright (0°), larger, IN FRONT of her (z-25 vs her z-20), 70% stroke, sitting on the bottom
          edge so its lower part spills below the hero. */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="neon-once pointer-events-none absolute inset-x-0 bottom-[-10vw] z-[25] flex h-[44vw] select-none items-center justify-center wide:inset-x-auto wide:bottom-auto wide:left-[60.2vw] wide:top-[-37.7vw] wide:z-10 wide:h-[126.7vw] wide:w-[37.6vw]"
      >
        <div className="flex h-[44vw] w-full flex-none items-center justify-center whitespace-nowrap font-display text-[40vw] leading-none tracking-[-0.07em] text-transparent [-webkit-text-stroke:2px_rgb(245_240_230/0.7)] wide:h-[37.6vw] wide:w-[126.7vw] wide:-rotate-90 wide:justify-start wide:text-[32.15vw] wide:[-webkit-text-stroke:3px_rgb(245_240_230/0.55)]">
          wangeci
        </div>
      </motion.div>

      {/* Cutout of Wangeci — fades up from the bottom. */}
      <motion.div
        initial={{ opacity: 0, y: 90 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="absolute bottom-0 left-1/2 z-20 aspect-[1440/1024] h-[60%] -translate-x-[69.8%] wide:left-auto wide:right-0 wide:h-full wide:translate-x-0"
      >
        <Image
          src="/images/DSC09752.jpg 2.png"
          alt="Felister Wangeci Kariuki"
          fill
          preload
          sizes="(min-width: 768px) and (min-aspect-ratio: 6/5) 100vw, 190vw"
          className="object-contain object-bottom"
        />
      </motion.div>

      {/* Text side */}
      <div className="relative z-30 mt-[5px] w-full px-6 text-center wide:mt-0 wide:w-auto wide:pl-[14.2vw] wide:text-left">
        <motion.h1
          initial={{ opacity: 0, x: -60 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="text-[clamp(5rem,29vw,7rem)] font-light leading-[0.92] tracking-[0.05em] text-gold sm:text-[clamp(7rem,20vw,12rem)] wide:text-[clamp(7rem,15.56vw,18rem)]"
        >
          Hello
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          aria-live="polite"
          className="mb-[3px] mt-6 flex flex-wrap items-baseline justify-center gap-x-2 text-[clamp(1rem,1.67vw,1.5rem)] tracking-[0.05em] sm:mt-8 sm:text-[clamp(1.125rem,3vw,1.75rem)] wide:mb-0 wide:mt-6 wide:justify-start wide:text-[clamp(1rem,1.67vw,1.5rem)]"
        >
          <span>— Its Wangeci Kariuki</span>
          <span className="inline-block overflow-hidden align-bottom">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={role.title}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.4 }}
                style={{ color: role.color }}
                className="inline-block text-[1.08em] font-medium"
              >
                {role.title}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.p>
      </div>

      {/* Left rail: role above the line, start year below it. */}
      <div
        aria-hidden
        className="absolute bottom-[24%] left-[21px] top-[32%] z-30 sm:left-9 w-px -translate-x-1/2 bg-gold wide:bottom-[15.5%] wide:left-[7.6vw] wide:top-[29%]"
      >
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-3 text-xs leading-none tracking-[0.05em] text-white sm:text-base wide:pb-5 wide:text-[26px]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={role.label}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={`block ${vertical}`}
            >
              {role.label}
            </motion.span>
          </AnimatePresence>
        </div>
        <div className="absolute left-1/2 top-full -translate-x-1/2 pt-4 text-xs font-medium leading-none tracking-[0.05em] sm:text-base wide:pt-7 wide:text-[26px]">
          <span className={`block ${vertical}`}>
            <NeonYear year={role.year} />
          </span>
        </div>
      </div>

      {/* Scroll down */}
      {/* Mobile: the arrow floats just above the top of her head (her image is the bottom 60%, bun ≈ 49% down). */}
      <div className="absolute bottom-[53%] left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 wide:bottom-[4%] wide:left-[14.2vw] wide:translate-x-0">
        {/* Text hidden on mobile: just the arrow, centred. */}
        <span className="hidden text-xl font-medium tracking-[0.07em] wide:inline">Scroll down</span>
        {/* Mobile rests 5s between rounds; desktop keeps its 3s rest. */}
        <ScrollArrow rest={5} className="wide:hidden" />
        <ScrollArrow rest={3} className="hidden wide:block" />
      </div>
    </section>
  );
}
