import type { Metadata } from "next";
import {
  BookPromoBanner,
  NumberedShowcaseItem,
  PortraitCollage,
} from "@/components/marketing";
import { ChevronDownIcon, SectionHeading } from "@/components/ui";
import { findBookBySlug } from "@/lib/mock-books";
import { findBusinessBySlug } from "@/lib/mock-businesses";

export const metadata: Metadata = {
  title: "Felister Wangechi Kariuki — Author & Entrepreneur",
};

const BIO_TEXT =
  "Wangechi Kariuki, a former Kameme TV journalist, grew up in a dysfunctional family—a background that deeply impacted her upbringing. Despite the challenges, she held on to a dream: to become a journalist and create a better life for herself.";

const ABOUT_PANELS = [
  { label: "AUTHOR" },
  { label: "mother" },
  { label: "journalist" },
  { label: "Wife" },
  { label: "Entrepreneur" },
];

const BOOK_PROMO_BLURB =
  "She walked barefoot to school on dusty village roads, raised by siblings barely older than herself...";

export default function HomePage() {
  const book = findBookBySlug("from-pieces-to-power");
  const business = findBusinessBySlug("fechi-organics");

  return (
    <>
      {/*
        Hero — full-bleed navy section. `Navbar` (rendered by
        app/(marketing)/layout.tsx) is a solid sticky cream bar per its
        existing implementation, not a transparent overlay — restyling it
        to float over this hero is out of scope here (it's an already-built
        shared component owned by another chunk of work), so the hero
        starts directly below it instead of behind it.
      */}
      <section className="relative isolate flex min-h-[560px] flex-col overflow-hidden bg-navy text-cream sm:min-h-[720px] lg:min-h-[860px]">
        {/*
          Placeholder hero photo. No hero photography has been exported
          from Figma yet — this is a deliberately plain gradient fill
          standing in for the real image, not a fake external image URL.
        */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(165deg, var(--color-navy) 0%, #081527 100%)",
          }}
        />

        {/* Decorative rotated watermark */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-[4%] -translate-y-1/2 translate-x-1/3 -rotate-90 whitespace-nowrap select-none font-display text-[10rem] leading-none text-cream/10 sm:text-[14rem] lg:right-[8%] lg:text-[18rem]"
        >
          wangeci
        </span>

        {/* Vertical side labels */}
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-5 hidden -translate-y-1/2 -rotate-90 whitespace-nowrap text-xs font-semibold tracking-[0.3em] text-cream/70 uppercase sm:block lg:left-10"
        >
          Author
        </span>
        <span
          aria-hidden="true"
          className="absolute top-1/2 right-5 hidden -translate-y-1/2 rotate-90 whitespace-nowrap text-xs font-semibold tracking-[0.3em] text-cream/70 uppercase sm:block lg:right-10"
        >
          2026
        </span>

        <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-6 py-20 sm:px-12 lg:px-24">
          <h1 className="font-display text-[5rem] leading-[0.9] text-gold sm:text-[8rem] lg:text-[11rem]">
            Hello
          </h1>
          <div className="mt-6 flex flex-col gap-1 text-lg sm:text-2xl">
            <span className="text-cream">— It&apos;s Wangeci Kariuki</span>
            <span className="font-medium text-gold">an entrepreneur</span>
          </div>
        </div>

        <div className="relative z-10 flex justify-center pb-10">
          <a
            href="#about"
            className="flex flex-col items-center gap-2 text-xs font-semibold tracking-[0.2em] text-cream/70 uppercase transition-colors hover:text-gold-bright"
          >
            Scroll down
            <ChevronDownIcon className="size-5 animate-bounce" />
          </a>
        </div>
      </section>

      {/* About Me */}
      <section id="about" className="bg-cream px-6 py-20 sm:px-12 lg:px-24 lg:py-28">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-12">
          <SectionHeading>About Me</SectionHeading>
          <p className="max-w-3xl text-base leading-relaxed text-navy/80 sm:text-lg">
            {BIO_TEXT}
          </p>
          <PortraitCollage panels={ABOUT_PANELS} />
        </div>
      </section>

      {/* What she's building */}
      <section className="bg-gray-light px-6 py-20 sm:px-12 lg:px-24 lg:py-28">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-14">
          <SectionHeading>What she&apos;s building</SectionHeading>
          {business && (
            <NumberedShowcaseItem
              number="1."
              name={business.name}
              description={business.description}
            />
          )}
        </div>
      </section>

      {/* Book promo */}
      {book && (
        <section className="bg-cream px-6 py-20 sm:px-12 lg:px-24 lg:py-28">
          <div className="mx-auto max-w-[1440px]">
            <BookPromoBanner book={book} blurb={BOOK_PROMO_BLURB} />
          </div>
        </section>
      )}
    </>
  );
}
