"use client";

import { create } from "zustand";

import { clearSecureCache, loadSecureCache, saveSecureCache } from "@/lib/client-cache/secure-cache";

/**
 * Display-only profile for the UI (name, masked contact). Deliberately NOT persisted with zustand's
 * `persist` middleware (that writes plain text); it is cached through the encrypted, split cache.
 * It is a convenience for fast first paint. The server decides who is signed in.
 */
export interface CachedProfile {
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  role: string;
  complete: boolean;
}

interface SessionState {
  profile: CachedProfile | null;
  status: "idle" | "loading" | "authed" | "anon";
  hydrate: () => Promise<void>;
  clear: () => void;
}

const NAMESPACE = "session";
const CHANNEL = "wangeci-auth";

export const useSessionStore = create<SessionState>((set) => ({
  profile: null,
  status: "idle",

  async hydrate() {
    set({ status: "loading" });
    const cached = await loadSecureCache<CachedProfile>(NAMESPACE);
    if (cached) set({ profile: cached, status: "authed" }); // optimistic, confirmed below

    try {
      const res = await fetch("/api/user/bootstrap", { cache: "no-store" });
      if (res.ok) {
        const profile = (await res.json()) as CachedProfile;
        set({ profile, status: "authed" });
        await saveSecureCache(NAMESPACE, profile);
      } else {
        clearSecureCache(NAMESPACE);
        set({ profile: null, status: "anon" });
      }
    } catch {
      // Offline: keep whatever the cache gave us.
      set((s) => ({ status: s.profile ? "authed" : "anon" }));
    }
  },

  clear() {
    clearSecureCache(NAMESPACE);
    set({ profile: null, status: "anon" });
  },
}));

/** Tell every other tab that this browser signed out. */
export function broadcastSignOut() {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(CHANNEL);
  channel.postMessage("signed-out");
  channel.close();
}

/** Call once on the client: clears this tab's state when another tab signs out. */
export function listenForSignOut(): () => void {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = (event) => {
    if (event.data === "signed-out") useSessionStore.getState().clear();
  };
  return () => channel.close();
}
