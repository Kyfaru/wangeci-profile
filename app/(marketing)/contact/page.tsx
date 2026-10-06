import type { Metadata } from "next";

import { ContactForm } from "@/components/contact/ContactForm";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: `Send a message to ${SITE.authorName}'s team.`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto min-h-[70vh] max-w-[640px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Contact</h1>
      <p className="mt-3 text-lg text-navy/70">Questions about the book, your order or working together? Send a message and we will reply by email.</p>
      <div className="mt-8">
        <ContactForm source="/contact" turnstileSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} />
      </div>
    </div>
  );
}
