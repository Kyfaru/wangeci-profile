"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OrderSummary } from "@/components/cart/OrderSummary";
import {
  PaymentMethodSelector,
  type PaymentMethod,
} from "@/components/cart/PaymentMethodSelector";
import { Button, FormField, Input, SectionHeading } from "@/components/ui";
import { useCartStore } from "@/lib/stores/cart-store";

interface ContactInfo {
  name: string;
  email: string;
  phone: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  mpesaPhone?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `/checkout` — contact info + M-Pesa/Paystack payment method selector.
 *
 * Guest-checkout style: the site is passwordless (per the auth redesign)
 * and there's no product-shipping model yet (checkout defaults to
 * digital/contact-info only per the plan's open questions — ebooks don't
 * need a shipping-address step), so this only ever asks for who to send the
 * order confirmation and ebook access to, then how to pay.
 *
 * "Pay Now" is frontend-only per the plan's scope: it simulates a brief
 * loading state (in place of an STK-push wait / Paystack redirect) and then
 * navigates to `/checkout/confirmation` — no real payment call is made.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const items = useCartStore((state) => state.items);

  const [contact, setContact] = useState<ContactInfo>({
    name: "",
    email: "",
    phone: "",
  });
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [isPending, setIsPending] = useState(false);

  if (items.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col items-center gap-5 px-6 py-24 text-center lg:px-12">
        <h1 className="font-display text-3xl text-navy">
          Your cart is empty
        </h1>
        <p className="max-w-md text-gray">
          Add a book to your cart before checking out.
        </p>
        <Button onClick={() => router.push("/store")}>
          Browse the store
        </Button>
      </div>
    );
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!contact.name.trim()) next.name = "Name is required.";
    if (!contact.email.trim()) next.email = "Email is required.";
    else if (!EMAIL_RE.test(contact.email))
      next.email = "Enter a valid email address.";
    if (!contact.phone.trim()) next.phone = "Phone number is required.";
    if (method === "mpesa" && !mpesaPhone.trim())
      next.mpesaPhone =
        "Enter the M-Pesa number to receive a payment prompt.";

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handlePayNow() {
    if (!validate()) return;

    setIsPending(true);
    // Frontend-only per the plan's scope — no real M-Pesa/Paystack call
    // here, just a brief simulated wait in place of the STK-push prompt /
    // Paystack redirect before landing on the mock confirmation page.
    setTimeout(() => {
      router.push("/checkout/confirmation");
    }, 1200);
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-16 lg:px-12">
      <SectionHeading
        eyebrow="Checkout"
        description="You're almost there — confirm your details and choose how to pay."
      >
        Checkout
      </SectionHeading>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="flex flex-col gap-8">
          <div className="rounded-card border border-navy/10 bg-white p-6">
            <h2 className="font-display text-xl text-navy">
              Contact information
            </h2>
            <p className="mt-1 text-sm text-gray">
              We&apos;ll send your order confirmation and ebook access here —
              no account needed.
            </p>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <FormField
                id="checkout-name"
                label="Full name"
                error={errors.name}
                required
                className="sm:col-span-2"
              >
                <Input
                  id="checkout-name"
                  name="name"
                  autoComplete="name"
                  placeholder="Jane Wanjiru"
                  value={contact.name}
                  invalid={Boolean(errors.name)}
                  onChange={(event) =>
                    setContact((c) => ({ ...c, name: event.target.value }))
                  }
                />
              </FormField>

              <FormField
                id="checkout-email"
                label="Email address"
                error={errors.email}
                required
              >
                <Input
                  id="checkout-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jane@email.com"
                  value={contact.email}
                  invalid={Boolean(errors.email)}
                  onChange={(event) =>
                    setContact((c) => ({ ...c, email: event.target.value }))
                  }
                />
              </FormField>

              <FormField
                id="checkout-phone"
                label="Phone number"
                error={errors.phone}
                required
              >
                <Input
                  id="checkout-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="07XX XXX XXX"
                  value={contact.phone}
                  invalid={Boolean(errors.phone)}
                  onChange={(event) =>
                    setContact((c) => ({ ...c, phone: event.target.value }))
                  }
                />
              </FormField>
            </div>
          </div>

          <div className="rounded-card border border-navy/10 bg-white p-6">
            <h2 className="font-display text-xl text-navy">
              Payment method
            </h2>
            <p className="mt-1 text-sm text-gray">
              Choose how you&apos;d like to pay.
            </p>

            <div className="mt-6">
              <PaymentMethodSelector
                value={method}
                onChange={setMethod}
                mpesaPhone={mpesaPhone}
                onMpesaPhoneChange={setMpesaPhone}
                mpesaPhoneError={errors.mpesaPhone}
              />
            </div>
          </div>
        </div>

        <OrderSummary
          lines={items.map((item) => ({
            id: item.id,
            title: item.title,
            qty: item.qty,
            price: item.price,
          }))}
          currency={items[0]?.currency ?? "KES"}
          footer={
            <Button
              className="w-full"
              size="lg"
              loading={isPending}
              onClick={handlePayNow}
            >
              Pay Now
            </Button>
          }
        />
      </div>
    </div>
  );
}
