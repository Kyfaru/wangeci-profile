import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { BOOK } from "@/lib/content/landing";
import { SITE } from "@/lib/site";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// First sentence of the book blurb, used as the pull quote (same text as the landing page).
const QUOTE = BOOK.blurb.split(". ")[0] + ".";

/** Split screen from the Figma auth frames: form on the left, brand panel on the right. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-[5vw]">
        <div className="mx-auto w-full max-w-[420px]">{children}</div>
      </main>

      <aside className="relative hidden overflow-hidden bg-brand-gradient text-white lg:block">
        {/* The portrait sits above the quote so the text never covers her face. */}
        <div className="absolute inset-x-0 bottom-[40%] top-24">
          <Image
            src="/images/wangeci-cutout.png"
            alt={`${SITE.authorName}, author of ${SITE.bookTitle}`}
            fill
            preload
            sizes="50vw"
            className="object-contain object-bottom"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/40 to-transparent" />

        <div className="absolute inset-x-10 top-10 flex items-center justify-between">
          <span className="flex items-center gap-2 rounded-full border border-white/20 bg-navy/60 px-4 py-2 text-xs font-medium">
            <span className="size-2 rounded-full bg-gold-bright" />
            Reader portal
          </span>
          <Link href="/" className="rounded-full bg-white px-5 py-2 text-sm font-medium text-navy transition-colors hover:bg-gold-bright">
            Back to site
          </Link>
        </div>

        <div className="absolute inset-x-10 bottom-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-bright">Discovering the power within</p>
          <blockquote className="mt-4 max-w-xl font-display text-[clamp(1.5rem,2.4vw,2.25rem)] leading-tight">&ldquo;{QUOTE}&rdquo;</blockquote>
          <p className="mt-4 text-sm text-white/80">
            {SITE.authorName}, author of <span className="text-gold-bright">{SITE.bookTitle}</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-xs">
            <span className="rounded-full border border-white/20 bg-navy/50 px-4 py-2">Secure one-time codes</span>
            <span className="rounded-full border border-white/20 bg-navy/50 px-4 py-2">Your library, on any device</span>
          </div>
        </div>
      </aside>
    </div>
  );
}
