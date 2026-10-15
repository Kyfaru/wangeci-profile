"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";

const KEY = "verify-banner-dismissed";

// sessionStorage is the "for this session" memory; it can throw in private windows, so a failed
// read just shows the banner.
const read = () => {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

/** Slim reminder for accounts created at checkout that have not confirmed their email or phone yet. */
export function VerifyBanner() {
  const dismissed = useSyncExternalStore(subscribe, read, () => true); // hidden on the server render
  if (dismissed) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      // storage unavailable: the banner just returns on the next page load
    }
    listeners.forEach((fn) => fn());
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-navy px-4 py-2 text-sm text-cream" role="status">
      <p>
        Please confirm your email and phone number to keep your account safe.{" "}
        <Link href="/verify?step=complete" className="underline">
          Confirm now
        </Link>
      </p>
      <button type="button" onClick={dismiss} className="shrink-0 underline" aria-label="Dismiss reminder">
        Dismiss
      </button>
    </div>
  );
}
