"use client";

import { useState } from "react";

import { OtpInput } from "@/components/auth/OtpInput";
import { authClient } from "@/lib/auth-client";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { describeAuthError } from "@/lib/auth/flow";

/**
 * Inline "confirm it is you" panel for sensitive actions. Emails a fresh code to the signed-in address and
 * checks it; the server remembers the proof for a few minutes, so `onDone` can simply retry the action.
 * Buttons are type="button" so the panel is safe inside a <form>.
 */
export function StepUp({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    const { data: session } = await authClient.getSession();
    const address = session?.user?.email;
    if (!address) {
      setBusy(false);
      return setError("Please sign in again.");
    }
    const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "email-verification" });
    setBusy(false);
    if (err) return setError(describeAuthError(err));
    setEmail(address);
  }

  async function verify(value: string) {
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.emailOtp.verifyEmail({ email, otp: value });
    setBusy(false);
    if (err) {
      setCode("");
      return setError(describeAuthError(err));
    }
    onDone();
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-4 text-sm text-black">
      <p>Please confirm it is you with a fresh code sent to your email.</p>
      {email ? (
        <div className="mt-3">
          <OtpInput length={OTP_LENGTH} value={code} onChange={setCode} onComplete={verify} disabled={busy} autoFocus />
        </div>
      ) : (
        <button type="button" onClick={send} disabled={busy} className="mt-3 rounded-full bg-navy px-5 py-2 font-medium text-cream hover:bg-gold disabled:opacity-50">
          {busy ? "Sending..." : "Email me a code"}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-error">
          {error}
        </p>
      )}
    </div>
  );
}
