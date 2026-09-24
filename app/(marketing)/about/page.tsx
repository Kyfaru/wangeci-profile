import type { Metadata } from "next";
import Link from "next/link";
import { PortraitCollage } from "@/components/marketing";
import { BookIcon } from "@/components/layout/icons";
import { HandshakeIcon, UsersIcon } from "@/components/marketing/icons";
import { Card, SectionHeading, StatChip } from "@/components/ui";

export const metadata: Metadata = {
  title: "About — Felister Wangechi Kariuki",
  description:
    "The full story of Felister \"Wangechi\" Kariuki — journalist, author, entrepreneur, wife, and mother.",
};

/**
 * Same panel set as the Home page's `#about` section — reused rather than
 * inventing a second set of labels, since no new portrait photography
 * exists to justify different panels yet (see `PortraitCollage`'s doc
 * comment: it's generic-by-design for exactly this kind of reuse).
 */
const ABOUT_PANELS = [
  { label: "AUTHOR" },
  { label: "mother" },
  { label: "journalist" },
  { label: "Wife" },
  { label: "Entrepreneur" },
];

/**
 * PLACEHOLDER COPY: the homepage only ships a terse two-sentence bio (see
 * `app/(marketing)/page.tsx`). Everything below is an elaborated "full"
 * version invented for this standalone page, consistent with that terse
 * bio's facts (Kameme TV journalist background, dysfunctional upbringing,
 * Fechi Organics, From Pieces To Power) but not sourced from any new
 * content brief.
 */
const STORY_SECTIONS = [
  {
    eyebrow: "01 — Before the cameras",
    title: "The journalist who almost gave up",
    body: "Felister \"Wangechi\" Kariuki grew up in a dysfunctional home, the kind of childhood that teaches you to survive before it teaches you to dream. She held onto one goal anyway: to become a journalist. She got there — years at Kameme TV, a byline, a reason to believe the hard years had led somewhere. Then her marriage and her income collapsed in the same year, and the story she'd been telling herself about her life stopped making sense.",
  },
  {
    eyebrow: "02 — The floor",
    title: "Rock bottom, and what it actually smells like",
    body: "She describes the lowest point plainly: sitting on the kitchen floor of a house that was no longer hers, holding a mug that was. Not dramatic. Just the quiet arithmetic of a life that no longer added up. What followed wasn't a montage — it was rent, casseroles from well-meaning neighbors, and the slow, unglamorous work of deciding to rebuild anyway.",
  },
  {
    eyebrow: "03 — KES 4,000 and a borrowed laptop",
    title: "Building Fechi Organics from the ground up",
    body: "Fechi Organics started with a name borrowed from her grandmother, a shea butter recipe, and a market stall in Nairobi. No investors, no marketing budget — just a willingness to have uncomfortable conversations about price and to keep showing up. It's now the venture that funds the rest of her work, and the case study she teaches from when she coaches other women starting over.",
  },
  {
    eyebrow: "04 — The book",
    title: "Writing From Pieces To Power",
    body: "Part memoir, part field guide, From Pieces To Power tells the story of that rebuild in full — messy, funny, spiritual, and practical in equal measure. Some chapters were written before she knew how her own story would end. It's become the anchor of everything else she's built: the coaching, the speaking, the community of readers rebuilding alongside her.",
  },
  {
    eyebrow: "05 — Still becoming",
    title: "Wife, mother, and still rebuilding out loud",
    body: "Off the page, Wangechi is a wife and mother who is candid that healing isn't a finish line — it's a practice she returns to, usually before coffee, usually while still a little afraid. That honesty is the thread running through her writing, her coaching, and the community she's built around Fechi Organics and From Pieces To Power.",
  },
];

/**
 * PLACEHOLDER figures — no real numbers were supplied; invented to give the
 * stats row plausible content until real figures are provided.
 */
const STATS = [
  { icon: <BookIcon />, count: "3", label: "books published" },
  { icon: <HandshakeIcon />, count: "2022", label: "Fechi Organics founded" },
  { icon: <UsersIcon />, count: "200+", label: "women coached" },
];

/**
 * `/about` — standalone expanded About page, separate from the homepage's
 * `#about` anchor section per the user's explicit decision to have both.
 * Reuses `PortraitCollage`; expanded bio content lives in `Card`-based
 * story blocks below.
 */
export default function AboutPage() {
  return (
    <div className="flex flex-col">
      <section className="bg-cream px-6 pt-16 pb-4 sm:px-12 lg:px-24">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-10">
          <SectionHeading
            eyebrow="About"
            description="Journalist. Author. Entrepreneur. Wife. Mother. Here's the full story behind From Pieces To Power and Fechi Organics."
          >
            The Full Story
          </SectionHeading>

          <PortraitCollage panels={ABOUT_PANELS} />

          <div className="flex flex-wrap gap-3">
            {STATS.map((stat) => (
              <StatChip
                key={stat.label}
                icon={stat.icon}
                count={stat.count}
                label={stat.label}
                variant="gold"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream px-6 py-16 sm:px-12 lg:px-24 lg:py-20">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
          {STORY_SECTIONS.map((section) => (
            <Card key={section.title} padding="lg" className="grid gap-4 lg:grid-cols-[220px_1fr] lg:gap-10">
              <span className="text-sm font-semibold tracking-[0.15em] text-gold uppercase">
                {section.eyebrow}
              </span>
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-2xl text-navy sm:text-3xl">
                  {section.title}
                </h2>
                <p className="max-w-3xl text-base leading-relaxed text-navy/80">
                  {section.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy px-6 py-20 text-cream sm:px-12 lg:px-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">
            Read the whole story in her own words
          </h2>
          <p className="max-w-xl text-base text-cream/70 sm:text-lg">
            From Pieces To Power is available now, along with The Shea
            Ledger and Letters to the Woman Rebuilding.
          </p>
          <Link
            href="/store"
            className="mt-2 inline-flex h-13 items-center justify-center rounded-full bg-gold px-8 text-lg font-medium tracking-tight text-navy transition-colors duration-150 hover:bg-gold-bright"
          >
            Visit the Store
          </Link>
        </div>
      </section>
    </div>
  );
}
