import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="6 October 2026 (draft)">
      <p>
        This explains what personal data this website collects, why, who helps us handle it, and how you can ask us to delete it. It is written to follow
        the Kenya Data Protection Act, 2019. TODO(client): the legal name of the business that is the data controller, and its Data Protection Commissioner registration number.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Your name, email address and phone number when you create an account, so we can sign you in and send receipts.</li>
        <li>Sign-in codes (stored only in scrambled form and for five minutes) and security records: when you signed in, which browser, and an anonymous browser id we set in a cookie.</li>
        <li>Your orders and payments (what you bought, the amount, the payment reference). We never see or store your card number or M-Pesa PIN.</li>
        <li>Your reading and listening progress, bookmarks and notification settings, so you can continue where you stopped.</li>
        <li>Messages you send us through the contact form.</li>
        <li>Technical error reports, which may include your browser type and the page where the error happened.</li>
      </ul>

      <h2>Who processes data for us</h2>
      <ul>
        <li>Neon: our database.</li>
        <li>Cloudflare: file storage (R2), bot checks (Turnstile) and network protection.</li>
        <li>Paystack and Safaricom (M-Pesa): payments.</li>
        <li>Resend: email. Africa&apos;s Talking: text messages.</li>
        <li>Upstash: sign-in code delivery queue and rate limiting.</li>
        <li>Sentry: error monitoring.</li>
        <li>Our web host (Vercel or our own server). A website analytics tool will be added later and this page will be updated before that happens.</li>
      </ul>
      <p>Some of these companies store data outside Kenya. We choose providers that protect it, and we share only what each one needs.</p>

      <h2>How long we keep it</h2>
      <p>
        Account and order records are kept while your account exists and for as long as the law requires us to keep financial records. Security logs are kept for
        12 months. Contact messages are removed from our admin inbox after 90 days. TODO(client): confirm these periods.
      </p>

      <h2>Your rights, and asking us to delete your data</h2>
      <p>
        You can ask to see, correct or delete your personal data. To do that, use the <Link href="/contact" className="underline">contact form</Link> and say you are
        making a privacy request. When we delete an account we remove your name, email, phone number, sign-in history and bookmarks, but we keep the order and
        payment records without your identity, because the law requires us to keep them. You can also complain to the Office of the Data Protection Commissioner.
      </p>
    </LegalPage>
  );
}
