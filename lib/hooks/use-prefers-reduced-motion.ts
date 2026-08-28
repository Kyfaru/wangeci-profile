"use client";

/**
 * Shared by `AuthCarousel` (crossfade timing) and `TwoFactorModal` (shake
 * + crossfade timing) — both need to know the user's reduced-motion
 * preference and react live if it changes mid-session.
 *
 * Implemented with `useSyncExternalStore` rather than
 * `useState` + `useEffect` on purpose: an effect-based version would call
 * its state setter synchronously on mount to pick up the *initial* value
 * (flagged by this repo's `react-hooks/set-state-in-effect` lint rule,
 * and genuinely the wrong tool here), and would still get the server/
 * first-client-render value wrong before that effect ever ran.
 * `useSyncExternalStore`'s `getServerSnapshot` gives a correct SSR value
 * (`false`) up front, and `subscribe` keeps it live afterward.
 */
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onStoreChange);
  return () => mql.removeEventListener("change", onStoreChange);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
