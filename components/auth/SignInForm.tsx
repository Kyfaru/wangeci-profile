"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { PhoneField, toE164 } from "@/components/auth/PhoneField";
import { TurnstileWidget, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import { authClient } from "@/lib/auth-client";
import { inputClass, primaryButton, sendCode } from "@/lib/auth/client-actions";
import { describeAuthError, saveFlow } from "@/lib/auth/flow";
import { cn } from "@/lib/cn";
import { AppIcon } from "@/lib/icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function SignInForm({
  redirect,
  googleEnabled,
  turnstileSiteKey,
  initialError,
}: {
  redirect: string;
  googleEnabled: boolean;
  turnstileSiteKey?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+254");
  const [number, setNumber] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    initialError === "SESSION_ALREADY_ACTIVE"
      ? "You are already signed in on another device. Sign in with an email or phone code to sign that device out."
      : initialError
        ? "Sign-in with that provider did not complete. Please try again."
        : null,
  );
  const widget = useRef<TurnstileHandle>(null);
  const needsToken = Boolean(turnstileSiteKey);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const identifier = tab === "email" ? email.trim().toLowerCase() : toE164(dial, number);
    if (!identifier || (tab === "email" && !EMAIL_RE.test(identifier))) {
      setError(tab === "email" ? "Enter a valid email address." : "Enter a valid phone number.");
      return;
    }

    setBusy(true);
    const { error: sendError } = await sendCode(tab, identifier, token);
    widget.current?.reset();
    setBusy(false);
    if (sendError) return setError(describeAuthError(sendError));

    saveFlow({ mode: "signin", via: tab, identifier, redirect });
    router.push("/verify");
  }

  return (
    <div>
      <h1 className="font-body text-4xl font-bold tracking-tight text-navy">Welcome Back !</h1>
      <p className="mt-2 text-base text-navy/60">Please enter your details to sign in to your reader portal</p>

      <div role="tablist" aria-label="Sign in with" className="mt-8 grid grid-cols-2 overflow-hidden rounded-2xl border border-navy">
        {(["email", "phone"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={cn("h-[50px] text-sm font-medium transition-colors", tab === t ? "bg-navy text-gold-bright" : "bg-white text-navy hover:bg-cream")}
          >
            {t === "email" ? "Email Address" : "Phone Number"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-4" noValidate>
        {tab === "email" ? (
          <label className="block">
            <span className="sr-only">Email address</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </label>
        ) : (
          <PhoneField dialCode={dial} number={number} onDialCode={setDial} onNumber={setNumber} />
        )}

        <TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} />

        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || (needsToken && !token)} className={cn(primaryButton, "mt-4")}>
          {busy ? "Sending code..." : tab === "email" ? "Continue with email" : "Continue with phone"}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="my-6 flex items-center gap-4 text-xs text-gray">
            <span className="h-px flex-1 bg-line" />
            OR
            <span className="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: redirect, errorCallbackURL: "/sign-in" })}
            className="flex h-[50px] w-full items-center justify-center gap-3 rounded-2xl border border-line bg-white text-sm font-medium text-navy transition-colors hover:bg-cream"
          >
            <AppIcon icon="logos:google-icon" size={18} />
            Continue with Google
          </button>
        </>
      )}

      <p className="mt-10 border-t border-line pt-6 text-sm text-navy/60">
        New to the reader portal?{" "}
        <Link href="/sign-up" className="font-medium text-navy underline underline-offset-4 hover:text-gold">
          Create an account
        </Link>
      </p>
    </div>
  );
}
