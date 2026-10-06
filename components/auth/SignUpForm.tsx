"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

import { PhoneField, toE164 } from "@/components/auth/PhoneField";
import { TurnstileWidget, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import { inputClass, primaryButton, sendCode } from "@/lib/auth/client-actions";
import { describeAuthError, saveFlow } from "@/lib/auth/flow";
import { cn } from "@/lib/cn";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(60),
  lastName: z.string().trim().min(1, "Enter your last name.").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export function SignUpForm({ redirect, turnstileSiteKey }: { redirect: string; turnstileSiteKey?: string }) {
  const router = useRouter();
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+254");
  const [number, setNumber] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widget = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = schema.safeParse({ firstName, lastName, email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    const phone = toE164(dial, number);
    if (!phone) return setError("Enter a valid phone number.");

    setBusy(true);
    const { error: sendError } = await sendCode("email", parsed.data.email, token);
    widget.current?.reset();
    setBusy(false);
    if (sendError) return setError(describeAuthError(sendError));

    saveFlow({
      mode: "signup",
      via: "email",
      identifier: parsed.data.email,
      name: `${parsed.data.firstName} ${parsed.data.lastName}`,
      phone,
      phoneDial: dial,
      phoneLocal: number,
      redirect,
    });
    router.push("/verify");
  }

  return (
    <div>
      <h1 className="font-display text-4xl text-gold">Create Your account</h1>
      <p className="mt-2 text-base text-navy/60">Please enter your information to access reader exclusives</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-3" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="sr-only">First name</span>
            <input value={firstName} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" placeholder="First name" className={inputClass} />
          </label>
          <label>
            <span className="sr-only">Last name</span>
            <input value={lastName} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" placeholder="Last name" className={inputClass} />
          </label>
        </div>
        <label className="block">
          <span className="sr-only">Email address</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" className={inputClass} />
        </label>
        <PhoneField dialCode={dial} number={number} onDialCode={setDial} onNumber={setNumber} />

        <TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} />

        {error && (
          <p role="alert" className="text-sm text-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || (Boolean(turnstileSiteKey) && !token)} className={cn(primaryButton, "!bg-navy !text-cream hover:!shadow-[0_10px_30px_rgb(12_33_66/0.3)]")}>
          {busy ? "Sending code..." : "Create account →"}
        </button>
        <p className="text-center text-xs text-navy/50">
          By creating an account you agree to the{" "}
          <Link href="/terms" className="underline">Terms &amp; Conditions</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </form>

      <p className="mt-10 border-t border-line pt-6 text-center text-sm text-navy/60">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-navy underline underline-offset-4 hover:text-gold">
          Log in
        </Link>
      </p>
    </div>
  );
}
