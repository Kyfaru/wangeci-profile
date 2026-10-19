import Link from "next/link";

import { SITE } from "@/lib/site";

/** Shown at the featured book's address while the book is not published (or cannot be read right now). */
export function ComingSoon() {
  return (
    <div className="mx-auto min-h-[70vh] max-w-[700px] px-6 pb-24 pt-32 text-center md:pt-40">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">Coming soon</p>
      <h1 className="mt-3 font-display text-4xl text-navy md:text-5xl">{SITE.bookTitle}</h1>
      <p className="mt-4 text-lg text-navy/70">This book is not available to buy just yet. Check back shortly, or get in touch and we will let you know when it is ready.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/store" className="rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
          Back to the store
        </Link>
        <Link href="/contact" className="rounded-[40px] border border-navy px-8 py-3 text-lg font-medium text-navy transition-colors hover:bg-navy hover:text-cream">
          Contact us
        </Link>
      </div>
    </div>
  );
}
