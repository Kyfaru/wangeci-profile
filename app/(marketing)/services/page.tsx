import type { Metadata } from "next";
import Link from "next/link";
import { ServiceCard } from "@/components/marketing/ServiceCard";
import {
  CompassIcon,
  HandshakeIcon,
  MicIcon,
  UsersIcon,
} from "@/components/marketing/icons";
import { SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Services — Felister Wangechi Kariuki",
  description:
    "Speaking, coaching, partnerships, and workshops with Felister \"Wangechi\" Kariuki.",
};

/**
 * PLACEHOLDER CONTENT: no Figma frame or content brief exists for a
 * services page (the plan flags this as "least-specified content"). The
 * four offerings below, their descriptions, and feature bullets are
 * invented — a plausible services lineup for an author/entrepreneur
 * platform — pending real copy from the client.
 */
const SERVICES = [
  {
    icon: <MicIcon />,
    title: "Speaking Engagements",
    description:
      "Keynotes and panel talks on rebuilding after loss, resilience, and turning a personal story into a business — for conferences, churches, and women's forums.",
    features: [
      "60–90 minute keynote or fireside chat",
      "Q&A and audience workshop add-on",
      "In-person (Nairobi & travel) or virtual",
    ],
  },
  {
    icon: <CompassIcon />,
    title: "Coaching & Mentorship",
    description:
      "One-on-one and small-group coaching for women starting over — divorce, job loss, grief — who are ready to rebuild their income and identity.",
    features: [
      "8-week 1:1 rebuild coaching program",
      "Monthly group mentorship circle",
      "Application-based, limited seats per cohort",
    ],
  },
  {
    icon: <HandshakeIcon />,
    title: "Brand Partnerships",
    description:
      "Collaborations with wellness, skincare, and women-owned brands that align with the Fechi Organics story and the From Pieces To Power audience.",
    features: [
      "Sponsored content & product collaborations",
      "Affiliate and referral partnerships",
      "Retreat and event co-hosting",
    ],
  },
  {
    icon: <UsersIcon />,
    title: "Corporate Workshops",
    description:
      "Half-day and full-day workshops for teams and organizations on resilience, storytelling, and building a business on borrowed time and borrowed money.",
    features: [
      "Half-day or full-day format",
      "Custom workbook for attendees",
      "Follow-up resource pack included",
    ],
  },
];

/**
 * `/services` — new page, no Figma frame or content spec exists for it.
 * Built to this project's shared design tokens/components; see the
 * PLACEHOLDER CONTENT note above the `SERVICES` array.
 */
export default function ServicesPage() {
  return (
    <div className="flex flex-col">
      <section className="mx-auto w-full max-w-[1440px] px-6 pt-16 pb-4 lg:px-12">
        <SectionHeading
          eyebrow="Services"
          description="Ways to work with Felister Wangechi Kariuki — on a stage, in a coaching room, or as a brand partner."
        >
          Work With Wangechi
        </SectionHeading>
      </section>

      <section className="mx-auto w-full max-w-[1440px] px-6 py-12 lg:px-12">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service) => (
            <ServiceCard key={service.title} {...service} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy px-6 py-20 text-cream sm:px-12 lg:px-24">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-6 text-center">
          <h2 className="font-display text-3xl sm:text-4xl">
            Let&apos;s build something together
          </h2>
          <p className="max-w-xl text-base text-cream/70 sm:text-lg">
            Tell us about your audience, your team, or your brand, and
            we&apos;ll follow up with availability and rates.
          </p>
          <Link
            href="mailto:hello@wangechikariuki.example.com"
            className="mt-2 inline-flex h-13 items-center justify-center rounded-full bg-gold px-8 text-lg font-medium tracking-tight text-navy transition-colors duration-150 hover:bg-gold-bright"
          >
            Get in touch
          </Link>
        </div>
      </section>
    </div>
  );
}
