import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ABOUT, BOOK_HREF } from "@/lib/content/landing";
import { jsonLd } from "@/lib/json-ld";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `${SITE.authorName}: author, entrepreneur and former Kameme TV journalist.`,
  alternates: { canonical: "/about" },
};

/**
 * `/about`: the author's story. Only text the client has supplied is shown as fact (the paragraph from
 * the Figma landing page); everything else is a visible TODO(client) outside production.
 */
export default function AboutPage() {
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: SITE.authorName,
    jobTitle: "Author and entrepreneur",
    description: ABOUT.body,
    image: `${SITE.url}/images/wangeci-author.jpg`,
    url: `${SITE.url}/about`,
  };

  return (
    <div className="mx-auto min-h-[70vh] max-w-[1100px] px-6 pb-24 pt-32 md:pt-40">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(person) }} />
      <div className="grid items-start gap-10 md:grid-cols-[1fr_380px]">
        <div>
          <h1 className="font-display text-4xl text-navy md:text-5xl">About {SITE.authorName}</h1>
          <p className="mt-6 text-xl leading-relaxed text-navy/80">{ABOUT.body}</p>
          {!SITE.isProduction && <p className="mt-6 text-navy/50">TODO(client): the full story, in her own words.</p>}
          <Link href={BOOK_HREF} className="mt-8 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
            Read her memoir
          </Link>
        </div>
        <div className="relative aspect-[3/4] overflow-hidden rounded-[20px] bg-navy">
          <Image src="/images/wangeci-author.jpg" alt={`${SITE.authorName}, author of ${SITE.bookTitle}`} fill sizes="(min-width: 768px) 380px, 100vw" className="object-cover object-top" />
        </div>
      </div>
    </div>
  );
}
