"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { BOOK, BOOK_HREF } from "@/lib/content/landing";

/** Gradient card promoting the book. Cover has the Figma gold "margin": 3px border, rounded right corners. */
export function BookSection() {
  return (
    // Mobile: no card — the whole section carries the gradient. md+: white page with the rounded gradient card.
    <section className="bg-[linear-gradient(79.63deg,var(--navy)_18.7%,var(--blue)_97.1%)] md:bg-white md:bg-none md:py-12">
      <div className="flex flex-col items-center gap-12 overflow-hidden px-4 py-14 md:mx-[3.5vw] md:rounded-[45px] md:bg-[linear-gradient(79.63deg,var(--navy)_18.7%,var(--blue)_97.1%)] md:px-8 lg:min-h-[758px] lg:flex-row lg:justify-center lg:gap-[clamp(2rem,3.89vw,4rem)] lg:px-[5.7vw]">
        <motion.div
          initial={{ opacity: 0, x: -60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="max-w-[651px] text-center md:text-left"
        >
          <h2 className="font-display text-[clamp(3rem,5.83vw,5.25rem)] leading-[0.9] text-white">
            {BOOK.titleTop}
            <br />
            {BOOK.titleBottom} <span className="text-gold-bright">{BOOK.accent}</span>
          </h2>
          <p className="mt-10 text-[clamp(1rem,1.67vw,1.5rem)] leading-[1.25] text-cream/80">
            {BOOK.blurb}
          </p>

          {/* Mobile: price stacked above the button, both centred. md+: button with the price beside it. */}
          <div className="mt-10 flex flex-col-reverse items-center gap-y-5 md:flex-row md:flex-wrap md:gap-x-10 md:gap-y-6">
            <Link
              href={BOOK_HREF}
              className="group inline-flex h-[55px] w-[319px] max-w-full items-center justify-center gap-3 rounded-[10px] bg-gold-bright text-[clamp(1.125rem,1.8vw,1.625rem)] font-medium text-black transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgb(253_193_5/0.35)]"
            >
              {BOOK.cta}
              <Image
                src="/icons/ri--arrow-right-long-line.png"
                alt=""
                width={30}
                height={30}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
            <div className="text-center">
              <p className="text-2xl text-[rgb(152_152_152/0.57)] line-through">{BOOK.oldPrice}</p>
              <p className="text-4xl font-medium text-cream">{BOOK.price}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 60 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative order-first h-[377px] w-[267px] shrink-0 overflow-hidden rounded-r-[30px] border-[3px] border-gold md:order-none md:h-[476px] md:w-[337px] lg:aspect-[337/476] lg:h-auto lg:w-[clamp(337px,29.17vw,420px)] lg:rounded-r-[clamp(30px,2.59vw,37px)]"
        >
          <Image
            src={BOOK.cover}
            alt="From Pieces To Power — book cover"
            fill
            sizes="(min-width: 1024px) 420px, (min-width: 768px) 337px, 267px"
            className="object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
