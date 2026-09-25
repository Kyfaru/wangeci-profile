"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { AppIcon } from "@/lib/icons";
import { cn } from "@/lib/cn";
import { FOOTER } from "@/lib/content/landing";

/** Outlined text that draws itself in, with a cursor-following gradient reveal on hover. */
function TextHoverEffect({
  text,
  duration,
  className,
}: {
  text: string;
  duration?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });

  useEffect(() => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setMaskPosition({
        cx: `${((cursor.x - rect.left) / rect.width) * 100}%`,
        cy: `${((cursor.y - rect.top) / rect.height) * 100}%`,
      });
    }
  }, [cursor]);

  const textProps = {
    x: "50%",
    y: "50%",
    textAnchor: "middle",
    dominantBaseline: "middle",
    strokeWidth: "0.3",
  } as const;

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 300 100"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className={cn("cursor-pointer select-none uppercase", className)}
    >
      <defs>
        <linearGradient id="textGradient" gradientUnits="userSpaceOnUse" cx="50%" cy="50%" r="25%">
          {hovered && (
            <>
              <stop offset="0%" stopColor="#fdc105" />
              <stop offset="25%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#f2b90d" />
              <stop offset="75%" stopColor="#7fd6a8" />
              <stop offset="100%" stopColor="#fdc105" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id="revealMask"
          gradientUnits="userSpaceOnUse"
          r="32%"
          initial={{ cx: "50%", cy: "50%" }}
          animate={maskPosition}
          transition={{ duration: duration ?? 0, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>
        <mask id="textMask">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#revealMask)" />
        </mask>
      </defs>
      {/* 1) Faint ghost outline that fades in while hovering. */}
      <text
        {...textProps}
        className="fill-transparent stroke-cream/30 font-display text-[68px] transition-opacity duration-300"
        style={{ opacity: hovered ? 0.5 : 0 }}
      >
        {text}
      </text>
      {/* 2) Subdued gold outline (40% opacity) that draws itself in when the footer scrolls into view. */}
      <motion.text
        {...textProps}
        className="fill-transparent stroke-gold/40 font-display text-[68px]"
        initial={{ strokeDashoffset: 1000, strokeDasharray: 1000 }}
        whileInView={{ strokeDashoffset: 0, strokeDasharray: 1000 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 4, ease: "easeInOut" }}
      >
        {text}
      </motion.text>
      {/* 3) Cursor-following gradient reveal — the bright element against the dimmed outline. */}
      <text
        {...textProps}
        stroke="url(#textGradient)"
        mask="url(#textMask)"
        className="fill-transparent font-display text-[68px]"
      >
        {text}
      </text>
    </svg>
  );
}

function FooterBackgroundGradient() {
  return (
    <div
      className="absolute inset-0 z-0"
      style={{
        background: "radial-gradient(125% 125% at 50% 10%, #0c214266 50%, #f2b90d33 100%)",
      }}
    />
  );
}

const linkClass = "transition-colors hover:text-gold";

export function Footer() {
  const { contact } = FOOTER;
  const contactRows = [
    { icon: "lucide:mail", text: contact.email, href: `mailto:${contact.email}` },
    { icon: "lucide:phone", text: contact.phone, href: `tel:${contact.phone.replace(/\s/g, "")}` },
    { icon: "lucide:map-pin", text: contact.place },
  ] as const;

  return (
    <footer className="relative h-fit overflow-hidden bg-navy text-cream/80">
      <div className="relative z-40 mx-auto max-w-7xl p-6 md:p-14">
        {/* Mobile: 2 columns × 2 rows (brand, Explore / Her Ventures, Contact); 4 across from lg. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 pb-12 text-sm md:gap-8 md:text-base lg:grid-cols-4 lg:gap-16">
          {/* Brand */}
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-3xl font-extrabold text-gold">&hearts;</span>
              <span className="font-display text-3xl text-white">Wangeci</span>
            </div>
            <p className="text-sm leading-relaxed">{FOOTER.blurb}</p>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">Explore</h4>
            <ul className="space-y-3">
              {FOOTER.explore.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={linkClass}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">Her Ventures</h4>
            <ul className="space-y-3">
              {FOOTER.ventures.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">Contact Us</h4>
            <ul className="space-y-4">
              {contactRows.map((row) => (
                <li key={row.icon} className="flex items-center space-x-2 md:space-x-3">
                  <AppIcon icon={row.icon} size={18} className="shrink-0 text-gold" />
                  {"href" in row ? (
                    <a href={row.href} className={`${linkClass} min-w-0 break-words`}>
                      {row.text}
                    </a>
                  ) : (
                    <span className="min-w-0 break-words">{row.text}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="my-8 border-t border-white/15" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm md:flex-row">
          <div className="flex space-x-6 text-white/60">
            {FOOTER.socials.map((s) => (
              <a key={s.label} href={s.href} aria-label={s.label} className={linkClass}>
                <AppIcon icon={s.icon} size={20} />
              </a>
            ))}
          </div>

          {/* <div>, not <p>: a block <motion.div> inside <p> is invalid HTML and breaks hydration. */}
          <div className="flex items-center gap-1 text-xs text-white/50">
            Powered by
            <Link
              href="https://kyfaru.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-white"
            >
              <motion.div
                animate={{
                  y: [0, -8, -8, -8, 0],
                  rotate: [0, -3, 3, -3, 3, -2, 2, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3, // rest 3s between each pulse-and-shake
                  ease: "easeInOut",
                  times: [0, 0.2, 0.35, 0.5, 1],
                }}
              >
                <Image
                  src="/images/Kyfaru-Logo-Filled-07.png"
                  alt="Kyfaru"
                  width={32}
                  height={32}
                  style={{ height: "auto" }}
                  className="object-contain"
                />
              </motion.div>
              <span>Kyfaru</span>
            </Link>
          </div>

          <p className="text-center md:text-left">
            &copy; {new Date().getFullYear()} Wangeci. All rights reserved.
          </p>
        </div>
      </div>

      {/* Text hover effect */}
      {/* Wordmark: scales with the viewport so it always runs edge to edge (68-unit type ≈ the full 300-unit
          viewBox; 72 pushed the final "I" off-screen). The negative bottom margin lets the footer's
          overflow-hidden crop its baseline, so the section is filled right to the bottom. */}
      {/* `relative z-50` matters: without it the background gradient (absolute, z-0) paints over the SVG and
          swallows the mouse, so the hover reveal never fires. The outline also now draws when scrolled into view. */}
      <div className="relative -mb-[11vw] -mt-[2vw] aspect-[3/1] w-full">
        <TextHoverEffect text="Wangeci" duration={0.25} className="relative z-50" />
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}
