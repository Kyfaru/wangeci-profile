import type { Metadata } from "next";
import Image from "next/image";

import { ContactForm } from "@/components/contact/ContactForm";
import { BUSINESSES } from "@/lib/content/landing";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Services",
  description: `The ventures and services of ${SITE.authorName}.`,
  alternates: { canonical: "/services" },
};

/** `/services`: her ventures plus the contact form. TODO(client): the list of services she offers (speaking, coaching, and so on). */
export default function ServicesPage() {
  return (
    <div className="mx-auto min-h-[70vh] max-w-[1100px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Services</h1>
      <p className="mt-3 max-w-2xl text-lg text-navy/70">
        {SITE.isProduction ? "" : "TODO(client): the services she offers. "}These are the ventures {SITE.authorName} is building.
      </p>

      <ul className="mt-10 grid gap-8 md:grid-cols-3">
        {BUSINESSES.map((b) => (
          <li key={b.name} className="overflow-hidden rounded-2xl bg-white shadow-sm">
            <div className="relative aspect-[4/3]">
              <Image src={b.image} alt={b.alt} fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />
            </div>
            <div className="p-6">
              <h2 className="font-display text-2xl text-navy">{b.name}</h2>
              <p className="mt-2 text-navy/70">{b.description}</p>
            </div>
          </li>
        ))}
      </ul>

      <section id="contact" className="mx-auto mt-20 max-w-[640px]">
        <h2 className="font-display text-3xl text-navy">Work with us</h2>
        <p className="mt-2 text-navy/70">Tell us what you need and we will get back to you.</p>
        <div className="mt-6">
          <ContactForm source="/services" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
        </div>
      </section>
    </div>
  );
}
