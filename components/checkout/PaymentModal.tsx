"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type PayPhase = "idle" | "processing" | "success" | "failed";

export interface PayModalState {
  phase: PayPhase;
  method: "card" | "mpesa";
  reason?: string;
  /** When "Try again" unlocks (epoch ms). */
  retryAt?: number;
  /** The final 24 hour lock: no retry, point to support. */
  contactSupport?: boolean;
}

const ID = "pay-modal";

type OverlayApi = { open: (t: HTMLElement) => void; close: (t: HTMLElement) => void; autoInit: () => void };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
};

/**
 * Payment progress dialog, built on Preline's overlay (the same `hs-overlay` markup and HSOverlay script
 * as the rest of the UI kit). Three faces: waiting for the PIN / confirmation, success, and failure with a
 * retry button that unlocks after a countdown. Escape and backdrop clicks are off on purpose: a payment in
 * progress must not be dismissed by accident.
 */
export function PaymentModal({ state, onRetry, onClose }: { state: PayModalState; onRetry: () => void; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const overlay = useRef<OverlayApi | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [warn, setWarn] = useState(false);
  const open = state.phase !== "idle";

  // Load Preline's overlay script once, in the browser only.
  useEffect(() => {
    let alive = true;
    import("preline/plugins/overlay-non-auto").then((m) => {
      if (!alive) return;
      overlay.current = m.default as unknown as OverlayApi;
      overlay.current.autoInit();
      if (open && root.current) overlay.current.open(root.current);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; opening is handled by the next effect
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!el || !overlay.current) return;
    if (open) overlay.current.open(el);
    else overlay.current.close(el);
  }, [open]);

  // Leaving the page while the dialog is open (the redirect to the thank-you page) must not leave Preline's backdrop behind.
  useEffect(() => {
    const el = root.current;
    return () => {
      if (el) overlay.current?.close(el);
      document.querySelectorAll("[id$='-backdrop'], .hs-overlay-backdrop").forEach((b) => b.remove());
      document.body.style.removeProperty("overflow");
    };
  }, []);

  // Countdown for the retry button.
  useEffect(() => {
    if (state.phase !== "failed" || !state.retryAt) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [state.phase, state.retryAt]);

  const remaining = state.retryAt ? Math.max(0, state.retryAt - now) : 0;
  const locked = remaining > 0;

  function handleRetry() {
    if (locked) {
      setWarn(true); // clicked early: explain instead of doing anything
      return;
    }
    setWarn(false);
    onRetry();
  }

  return (
    <div
      ref={root}
      id={ID}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${ID}-title`}
      tabIndex={-1}
      data-hs-overlay-keyboard="false"
      className="hs-overlay hidden size-full fixed start-0 top-0 z-80 overflow-y-auto overflow-x-hidden"
    >
      <div className="m-3 flex min-h-[calc(100%-1.5rem)] items-center opacity-0 transition-all duration-300 hs-overlay-open:opacity-100 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="w-full rounded-3xl bg-white p-8 text-center shadow-2xl" aria-live="polite">
          {state.phase === "processing" && (
            <>
              <div className="mx-auto size-14 animate-spin rounded-full border-4 border-navy/15 border-t-gold" aria-hidden />
              <h2 id={`${ID}-title`} className="mt-6 font-display text-2xl text-navy">
                {state.method === "mpesa" ? "Enter your M-Pesa PIN" : "Confirming your payment"}
              </h2>
              <p className="mt-2 text-navy/70">{state.method === "mpesa" ? "A prompt was sent to your phone. Enter your PIN to pay. Do not close this page." : "Please wait while the bank confirms. Do not close this page."}</p>
            </>
          )}

          {state.phase === "success" && (
            <>
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-green/15 text-green" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 id={`${ID}-title`} className="mt-6 font-display text-2xl text-navy">
                Payment received
              </h2>
              <p className="mt-2 text-navy/70">Taking you to your order...</p>
            </>
          )}

          {state.phase === "failed" && (
            <>
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-error/10 text-error" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </div>
              <h2 id={`${ID}-title`} className="mt-6 font-display text-2xl text-navy">
                Payment failed
              </h2>
              <p className="mt-2 text-lg text-navy/80">{state.reason}</p>

              {state.contactSupport ? (
                <Link href="/contact" className="mt-6 inline-block rounded-2xl bg-navy px-6 py-3 text-cream hover:bg-gold">
                  Contact support
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleRetry}
                    aria-disabled={locked}
                    className={cn(
                      "mt-6 flex h-[52px] w-full items-center justify-center rounded-2xl text-lg font-medium transition-colors",
                      locked ? "cursor-not-allowed bg-navy/10 text-navy/50" : "bg-gold-bright text-black hover:-translate-y-0.5",
                    )}
                  >
                    {locked ? `Try again in ${fmt(remaining)}` : "Try again"}
                  </button>
                  {warn && locked && (
                    <p role="alert" className="mt-3 text-sm text-error">
                      A current transaction is underway, please wait.
                    </p>
                  )}
                </>
              )}
              <button type="button" onClick={onClose} className="mt-4 text-sm text-navy/60 underline underline-offset-4 hover:text-gold">
                Change details
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
