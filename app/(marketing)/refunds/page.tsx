import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund Policy", alternates: { canonical: "/refunds" } };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund Policy" updated="6 October 2026 (draft)">
      <p>Digital books are delivered straight to your account, so refunds are handled case by case. TODO(client): the refund window (for example the number of days) and the conditions.</p>

      <h2>When we will refund</h2>
      <ul>
        <li>You were charged but did not get access to the book.</li>
        <li>You were charged twice for the same book.</li>
        <li>The file or audio is faulty and we cannot fix it.</li>
      </ul>

      <h2>How to ask</h2>
      <p>
        Send the details through the <Link href="/contact" className="underline">contact form</Link>, including the email or phone number on your account and your
        payment reference. We will review it and tell you the result.
      </p>

      <h2>What happens when we refund</h2>
      <p>
        We start the refund with the payment provider. Your access to the book is removed when the provider confirms the refund. Card refunds go back to your card;
        TODO(client): how M-Pesa refunds are paid back and how long they take.
      </p>
    </LegalPage>
  );
}
