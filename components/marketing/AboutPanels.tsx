"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { ABOUT, ABOUT_PANELS } from "@/lib/content/landing";

/**
 * About: intro text + a five-panel accordion.
 * Rules: hover previews a panel; click pins it (stays open when the cursor
 * leaves); click the pinned panel again to close it. Entrepreneur starts pinned.
 */
export function AboutPanels() {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(0);
  // Index just un-pinned while still under the cursor — ignore its hover so it actually closes.
  const [muted, setMuted] = useState<number | null>(null);

  const active = hovered !== null && hovered !== muted ? hovered : pinned;

  const toggle = (i: number) => {
    if (pinned === i) {
      setPinned(null);
      setMuted(i);
    } else {
      setPinned(i);
      setMuted(null);
    }
  };

  const leave = (i: number) => {
    setHovered(null);
    setMuted((m) => (m === i ? null : m));
  };

  return (
    <section
      id="about"
      className="relative overflow-hidden bg-cream lg:grid lg:h-[830px] lg:grid-cols-[552fr_888fr]"
    >
      <div className="relative px-6 pb-16 pt-20 lg:px-[5.1vw] lg:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-[clamp(2.25rem,3.33vw,3rem)] font-normal text-black">
            {ABOUT.heading}
          </h2>
          <p className="mt-3 max-w-[444px] font-body text-[clamp(1rem,1.53vw,1.375rem)] font-light leading-[1.18] text-gray">
            {ABOUT.body}
          </p>
        </motion.div>

        {/* Decorative arrow: 11% opacity, rotated 168.282deg. */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1, delay: 0.2 }}
          className="pointer-events-none absolute left-[10.5vw] top-[553px] hidden lg:block"
        >
          <Image
            src="/images/left-arrow.png"
            alt=""
            width={321}
            height={321}
            className="rotate-[168.282deg] opacity-[0.11]"
          />
        </motion.div>
      </div>

      {/* Mobile height = 347 (open row) + 4 × 64 (closed rows) = 603; desktop fills the section. */}
      <div className="flex h-[603px] flex-col lg:h-full lg:flex-row">
        {ABOUT_PANELS.map((p, i) => {
          const isActive = active === i;
          return (
            <motion.button
              key={p.label}
              type="button"
              data-active={isActive}
              aria-expanded={isActive}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => leave(i)}
              onFocus={() => setHovered(i)}
              onBlur={() => leave(i)}
              onClick={() => toggle(i)}
              initial={{ opacity: 0, x: 60 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.7, delay: i * 0.1 }}
              className="about-panel group relative min-h-0 min-w-0 cursor-pointer overflow-hidden text-left transition-[flex-grow] duration-[800ms] ease-[cubic-bezier(.65,0,.35,1)] [flex:64_1_0%] data-[active=true]:[flex:347_1_0%] lg:[flex:138_1_0%] lg:data-[active=true]:[flex:336_1_0%]"
            >
              <Image
                src={p.image}
                alt=""
                fill
                sizes="(min-width: 1024px) 40vw, 100vw"
                style={{ objectPosition: p.position }}
                className="object-cover grayscale transition-[filter,scale] duration-[900ms] group-data-[active=true]:scale-105 group-data-[active=true]:grayscale-0"
              />
              {/* Per-image colour gradient: top third clear, bottom two thirds tinted (see .panel-tint). */}
              <span
                aria-hidden
                style={{ "--tint": p.tint } as React.CSSProperties}
                className="panel-tint absolute inset-0 opacity-90 transition-opacity duration-700 group-data-[active=true]:opacity-100"
              />

              <span className="panel-label font-display text-gold-bright">{p.label}</span>
              <span className="panel-desc text-[clamp(1rem,1.67vw,1.5rem)] font-light leading-[1.156] text-cream">
                {p.blurb}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
