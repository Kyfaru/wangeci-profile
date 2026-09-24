"use client";

import type { ComponentType, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { FormField, Input } from "@/components/ui";
import { CreditCardIcon, SmartphoneIcon } from "./icons";

export type PaymentMethod = "mpesa" | "paystack";

export interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  mpesaPhone: string;
  onMpesaPhoneChange: (value: string) => void;
  mpesaPhoneError?: string;
  className?: string;
}

interface MethodOption {
  key: PaymentMethod;
  label: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const METHODS: MethodOption[] = [
  {
    key: "mpesa",
    label: "M-Pesa",
    description: "Pay via an STK push prompt to your phone",
    icon: SmartphoneIcon,
  },
  {
    key: "paystack",
    label: "Paystack",
    description: "Pay by card, redirected to Paystack",
    icon: CreditCardIcon,
  },
];

/**
 * Two selectable radio-cards for M-Pesa vs. Paystack, plus the matching
 * sub-form beneath whichever one is selected (an M-Pesa phone-number input,
 * or a redirect notice for Paystack).
 *
 * Structure follows Preline UI's own radio-card pattern
 * (https://preline.co/docs/radio.html): a `<label>` wraps a native
 * `input[type=radio]` styled via `checked:`/`has-checked:` — Preline needs
 * no JS init for this one (it's pure Tailwind, unlike its modal/dropdown
 * components), so it's reproduced directly with this project's own tokens
 * rather than pulled in as a snippet. Native radios (vs. hand-rolled
 * `role="radio"` buttons) also get arrow-key group navigation for free.
 */
export function PaymentMethodSelector({
  value,
  onChange,
  mpesaPhone,
  onMpesaPhoneChange,
  mpesaPhoneError,
  className,
}: PaymentMethodSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="radiogroup"
        aria-label="Payment method"
        className="grid gap-4 sm:grid-cols-2"
      >
        {METHODS.map((method) => {
          const selected = value === method.key;
          const Icon = method.icon;

          return (
            <label
              key={method.key}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors duration-150",
                selected
                  ? "border-gold bg-gold/5"
                  : "border-navy/10 bg-white hover:border-navy/20",
              )}
            >
              <input
                type="radio"
                name="payment-method"
                value={method.key}
                checked={selected}
                onChange={() => onChange(method.key)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full",
                  selected ? "bg-gold text-navy" : "bg-gray-light text-gray",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium text-navy">{method.label}</span>
                <span className="text-sm text-gray">
                  {method.description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 ml-auto flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                  selected ? "border-gold bg-gold" : "border-navy/20",
                )}
              >
                {selected && <span className="size-2 rounded-full bg-navy" />}
              </span>
            </label>
          );
        })}
      </div>

      {value === "mpesa" ? (
        <div className="rounded-xl bg-gray-light/60 p-4">
          <FormField
            id="mpesa-phone"
            label="M-Pesa phone number"
            hint="Enter the M-Pesa number to receive a payment prompt."
            error={mpesaPhoneError}
            required
          >
            <Input
              id="mpesa-phone"
              name="mpesaPhone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07XX XXX XXX"
              value={mpesaPhone}
              invalid={Boolean(mpesaPhoneError)}
              onChange={(event) => onMpesaPhoneChange(event.target.value)}
            />
          </FormField>
        </div>
      ) : (
        <div className="rounded-xl bg-gray-light/60 p-4 text-sm text-navy/70">
          You&apos;ll be redirected to Paystack to complete payment.
        </div>
      )}
    </div>
  );
}
