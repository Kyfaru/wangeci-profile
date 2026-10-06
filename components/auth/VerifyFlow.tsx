"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { mergeCart } from "@/app/actions/cart";
import { OtpInput } from "@/components/auth/OtpInput";
import { PhoneField, toE164 } from "@/components/auth/PhoneField";
import { TurnstileWidget, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import { TwoFactorModal } from "@/components/auth/TwoFactorModal";
import { authClient } from "@/lib/auth-client";
import { maskIdentifier, primaryButton, sendCode } from "@/lib/auth/client-actions";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { clearFlow, describeAuthError, loadFlow, saveFlow, type Flow } from "@/lib/auth/flow";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { cn } from "@/lib/cn";
import { useCartStore } from "@/lib/stores/cart-store";
import { useSessionStore } from "@/lib/stores/session-store";

type Step = "loading" | "code" | "phone-send" | "phone-code" | "blocked";

const RESEND_COOLDOWN_SECONDS = 60;

export function VerifyFlow({ complete, redirect, turnstileSiteKey }: { complete: boolean; redirect: string; turnstileSiteKey?: string }) {
  const router = useRouter();
  // Rendered client-only (see VerifyFlowClient), so sessionStorage is safe to read while initialising.
  const [flow, setFlow] = useState<Flow | null>(() =>
    complete ? { mode: "complete", via: "email", identifier: "", redirect } : loadFlow(),
  );
  const [step, setStep] = useState<Step>(() => (complete ? "phone-send" : flow ? "code" : "loading"));
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(() => (!complete && flow ? RESEND_COOLDOWN_SECONDS : 0));
  const [token, setToken] = useState<string | null>(null);
  const [twoFactor, setTwoFactor] = useState(false);
  const [dial, setDial] = useState("+254");
  const [number, setNumber] = useState("");
  const widget = useRef<TurnstileHandle>(null);
  const needsToken = Boolean(turnstileSiteKey);

  // No saved flow and not completing a profile: nothing to verify, send them to sign in.
  useEffect(() => {
    if (step === "loading") router.replace("/sign-in");
  }, [step, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const finish = useCallback(async () => {
    clearFlow();
    // Merge the browser shopping list into the saved cart (deduplicated, quantity one).
    const ids = useCartStore.getState().items.map((i) => i.editionId).filter((id): id is string => Boolean(id));
    if (ids.length > 0) await mergeCart(ids).catch(() => {});
    await useSessionStore.getState().hydrate();
    router.replace(safeRedirect(flow?.redirect ?? redirect));
    router.refresh();
  }, [flow?.redirect, redirect, router]);

  /** Runs after the first code is accepted and a session exists. */
  const afterSignedIn = useCallback(
    async (current: Flow) => {
      if (current.mode === "signup") {
        if (current.name) await authClient.updateUser({ name: current.name });
        if (current.phone) {
          setDial(current.phoneDial ?? "+254");
          setNumber(current.phoneLocal ?? "");
          setCode("");
          setStep("phone-send");
          return;
        }
      }
      await finish();
    },
    [finish],
  );

  async function verifyFirstCode(value: string) {
    if (!flow || busy) return;
    setBusy(true);
    setError(null);
    const res =
      flow.via === "email"
        ? await authClient.signIn.emailOtp({ email: flow.identifier, otp: value })
        : await authClient.phoneNumber.verify({ phoneNumber: flow.identifier, code: value });
    setBusy(false);

    if (res.error) {
      if (res.error.code === "SESSION_ALREADY_ACTIVE") return setStep("blocked");
      setCode("");
      return setError(describeAuthError(res.error));
    }
    if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) return setTwoFactor(true);
    await afterSignedIn(flow);
  }

  async function sendPhoneCode() {
    if (!flow) return;
    const phone = toE164(dial, number);
    if (!phone) return setError("Enter a valid phone number.");
    setBusy(true);
    setError(null);
    const { error: err } = await sendCode("phone", phone, token);
    widget.current?.reset();
    setBusy(false);
    if (err) return setError(describeAuthError(err));
    const next = { ...flow, phone };
    setFlow(next);
    saveFlow(next);
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("phone-code");
  }

  async function verifyPhoneCode(value: string) {
    if (!flow?.phone || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.phoneNumber.verify({ phoneNumber: flow.phone, code: value, updatePhoneNumber: true });
    setBusy(false);
    if (err) {
      setCode("");
      return setError(describeAuthError(err));
    }
    await finish();
  }

  async function resend() {
    if (!flow || cooldown > 0) return;
    const via = step === "phone-code" ? "phone" : flow.via;
    const to = step === "phone-code" ? flow.phone : flow.identifier;
    if (!to) return;
    setError(null);
    const { error: err } = await sendCode(via, to, token);
    widget.current?.reset();
    if (err) return setError(describeAuthError(err));
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  /** "Sign out the other device and continue": record consent, then ask for a fresh code. */
  async function replaceOtherDevice() {
    if (!flow) return;
    setBusy(true);
    setError(null);
    await fetch("/api/session/replace-consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: flow.identifier }),
    });
    const { error: err } = await sendCode(flow.via, flow.identifier, token);
    widget.current?.reset();
    setBusy(false);
    if (err) return setError(describeAuthError(err));
    setCode("");
    setCooldown(RESEND_COOLDOWN_SECONDS);
    setStep("code");
  }

  if (step === "loading" || !flow) return <p className="text-navy/60">Loading...</p>;

  const heading =
    step === "phone-send" ? "Verify your phone" : step === "phone-code" ? "Enter the phone code" : step === "blocked" ? "Already signed in" : "Enter verification code";

  return (
    <div>
      <h1 className="font-display text-4xl text-gold">{heading}</h1>

      {(step === "code" || step === "phone-code") && (
        <>
          <p className="mt-3 text-base text-navy/60">
            We&apos;ve sent a {OTP_LENGTH}-digit code to your {step === "phone-code" || flow.via === "phone" ? "phone" : "email"}
          </p>
          <span className="mt-2 inline-block rounded-md bg-cream px-2 py-1 text-xs text-navy">
            {maskIdentifier(step === "phone-code" ? (flow.phone ?? "") : flow.identifier)}
          </span>
          <div className="mt-8">
            <OtpInput
              length={OTP_LENGTH}
              value={code}
              onChange={setCode}
              onComplete={step === "code" ? verifyFirstCode : verifyPhoneCode}
              disabled={busy}
              invalid={Boolean(error)}
              autoFocus
            />
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-error">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy || code.length !== OTP_LENGTH}
            onClick={() => (step === "code" ? verifyFirstCode(code) : verifyPhoneCode(code))}
            className={cn(primaryButton, "mt-6 !bg-navy !text-cream")}
          >
            {busy ? "Checking..." : "Verify code →"}
          </button>
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-line bg-cream/50 px-4 py-3 text-sm">
            <span className="text-navy/60">Didn&apos;t get a code?</span>
            <button
              type="button"
              onClick={resend}
              disabled={cooldown > 0 || (needsToken && !token)}
              className="font-medium text-navy disabled:cursor-not-allowed disabled:text-navy/40"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Click to resend"}
            </button>
          </div>
          <TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} />
        </>
      )}

      {step === "phone-send" && (
        <>
          <p className="mt-3 text-base text-navy/60">We also need to confirm your phone number. We will text you a {OTP_LENGTH}-digit code.</p>
          <div className="mt-6">
            <PhoneField dialCode={dial} number={number} onDialCode={setDial} onNumber={setNumber} />
          </div>
          <TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} />
          {error && (
            <p role="alert" className="mt-3 text-sm text-error">
              {error}
            </p>
          )}
          <button type="button" disabled={busy || (needsToken && !token)} onClick={sendPhoneCode} className={cn(primaryButton, "mt-6")}>
            {busy ? "Sending code..." : "Send code"}
          </button>
        </>
      )}

      {step === "blocked" && (
        <>
          <p className="mt-3 text-base text-navy/60">
            This account is already signed in on another device. You can sign that device out and continue here. We will send you a fresh code to confirm.
          </p>
          <TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} />
          {error && (
            <p role="alert" className="mt-3 text-sm text-error">
              {error}
            </p>
          )}
          <button type="button" disabled={busy || (needsToken && !token)} onClick={replaceOtherDevice} className={cn(primaryButton, "mt-6 !bg-navy !text-cream")}>
            {busy ? "Working..." : "Sign out the other device and continue"}
          </button>
        </>
      )}

      {!complete && (
        <Link href="/sign-in" onClick={clearFlow} className="mt-10 inline-block text-sm text-navy/60 underline underline-offset-4 hover:text-gold">
          ← Back to log in
        </Link>
      )}

      {twoFactor && (
        <TwoFactorModal
          onVerified={() => {
            setTwoFactor(false);
            if (flow) void afterSignedIn(flow);
          }}
          onCancel={() => setTwoFactor(false)}
        />
      )}
    </div>
  );
}
