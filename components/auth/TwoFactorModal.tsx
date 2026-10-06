"use client";

import { useState } from "react";

import { OtpInput } from "@/components/auth/OtpInput";
import { authClient } from "@/lib/auth-client";
import { describeAuthError } from "@/lib/auth/flow";

const TOTP_LENGTH = 6; // authenticator apps always show 6 digits

/** Second step for accounts with an authenticator app (admins). Shown after the first code succeeds. */
export function TwoFactorModal({ onVerified, onCancel }: { onVerified: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.twoFactor.verifyTotp({ code: value });
    setBusy(false);
    if (err) {
      setCode("");
      return setError(describeAuthError(err));
    }
    onVerified();
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tf-title" className="fixed inset-0 z-50 grid place-items-center bg-navy/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <h2 id="tf-title" className="font-display text-2xl text-navy">
          Two-step check
        </h2>
        <p className="mt-2 text-sm text-navy/60">Open your authenticator app and enter the 6-digit code for Wangeci.</p>
        <div className="mt-6">
          <OtpInput length={TOTP_LENGTH} value={code} onChange={setCode} onComplete={verify} disabled={busy} invalid={Boolean(error)} autoFocus />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-error">
            {error}
          </p>
        )}
        <button type="button" onClick={onCancel} className="mt-6 text-sm text-navy/60 underline underline-offset-4 hover:text-gold">
          Cancel
        </button>
      </div>
    </div>
  );
}
