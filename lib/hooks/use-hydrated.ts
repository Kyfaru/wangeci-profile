"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` on the server and during hydration, `true` afterwards. Gate anything
 * that reads the localStorage-persisted cart store behind it, otherwise the
 * server HTML (empty cart) and the first client render (real cart) disagree.
 * `useSyncExternalStore` rather than `useEffect` + `setState` — see
 * use-prefers-reduced-motion.ts for why.
 */
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
