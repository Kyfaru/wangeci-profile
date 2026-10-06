import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms & Conditions", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <LegalPage title="Terms & Conditions" updated="6 October 2026 (draft)">
      <p>These terms apply when you use this website, create an account or buy a digital book. By creating an account you agree to them. TODO(client): the legal name of the seller.</p>

      <h2>Your account</h2>
      <p>
        You sign in with a one-time code sent to your email or phone, or with Google. Keep your phone and email safe: anyone who has them can sign in as you.
        An account can be signed in on one device at a time. Signing in on a new device can sign the old one out.
      </p>

      <h2>What you are buying</h2>
      <p>
        Books are digital (ebook and, when available, audiobook). A purchase gives you a personal licence to read or listen on your own account. You may not copy,
        share, resell or upload the content. Copying text on screen cannot be fully prevented, but doing it to share the book is not allowed.
      </p>

      <h2>Prices and payment</h2>
      <p>Prices are shown in Kenyan shillings (KES). Payment is handled by Paystack (cards) and M-Pesa. Your purchase is confirmed when we receive confirmation from the payment provider, not when you return to our website.</p>

      <h2>Refunds</h2>
      <p>See the <Link href="/refunds" className="underline">refund policy</Link>.</p>

      <h2>Using the site</h2>
      <p>Do not try to break, overload or get around the security of the site. We may suspend accounts that do.</p>

      <h2>Contact</h2>
      <p>Questions about these terms: use the <Link href="/contact" className="underline">contact form</Link>.</p>
    </LegalPage>
  );
}
