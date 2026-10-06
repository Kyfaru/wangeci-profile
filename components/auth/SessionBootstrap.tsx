"use client";

import { useEffect } from "react";

import { listenForSignOut, useSessionStore } from "@/lib/stores/session-store";

/** Mounted once in the app providers: fills the display cache and follows sign-outs from other tabs. */
export function SessionBootstrap() {
  const hydrate = useSessionStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
    return listenForSignOut();
  }, [hydrate]);
  return null;
}
