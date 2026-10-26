import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage, Todo } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Cookie Notice", alternates: { canonical: "/cookies" } };

export default function CookiesPage() {
  return (
    <LegalPage title="Cookie Notice" updated="6 October 2026 (draft)">
      <p>This site uses only the cookies and browser storage it needs to work. It does not use advertising cookies. Optional services are listed below and load only if we switch them on.</p>

      <h2>What we store in your browser</h2>
      <ul>
        <li><strong>Sign-in cookie</strong>: keeps you signed in. Essential.</li>
        <li><strong>Browser id cookie</strong>: a random id that helps us notice when your account is used on another device. Essential for security.</li>
        <li><strong>Cart</strong>: the books you added, kept in your browser until you buy them.</li>
        <li><strong>Profile cache</strong>: your name, in scrambled form, so pages load faster. It is cleared when you sign out.</li>
        <li><strong>Analytics (Umami)</strong>, if enabled: counts visits to understand how the site is used.</li>
        <li><strong>Chat widget (Chatwoot)</strong>, if enabled: lets you message us, and may keep an identifier in your browser so the conversation continues.</li>
        <li><strong>Bot check (Cloudflare Turnstile)</strong>: runs on forms such as sign-in and contact to tell people from bots.</li>
        <Todo><li>TODO(lawyer): confirm what each optional service stores and the wording here.</li></Todo>
      </ul>

      <h2>Your choices</h2>
      <p>
        You can delete these in your browser settings, but then you will be signed out and the cart will be emptied. For questions use the{" "}
        <Link href="/contact" className="underline">contact form</Link>. More about your data is in the <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
