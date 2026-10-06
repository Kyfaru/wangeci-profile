"use client";

import { useRouter } from "next/navigation";

import { TwoFactorModal } from "@/components/auth/TwoFactorModal";
import { authClient } from "@/lib/auth-client";
import { safeRedirect } from "@/lib/auth/safe-redirect";
import { broadcastSignOut, useSessionStore } from "@/lib/stores/session-store";

/** Shown when someone is signed in but still owes the authenticator code (for example after Google sign-in, or a reload). */
export function TwoFactorStep({ redirect }: { redirect: string }) {
  const router = useRouter();
  return (
    <div>
      <h1 className="font-display text-4xl text-gold">Two-step check</h1>
      <p className="mt-3 text-navy/60">Enter the code from your authenticator app to finish signing in.</p>
      <TwoFactorModal
        onVerified={async () => {
          await useSessionStore.getState().hydrate();
          router.replace(safeRedirect(redirect));
          router.refresh();
        }}
        onCancel={async () => {
          await authClient.signOut();
          useSessionStore.getState().clear();
          broadcastSignOut();
          router.replace("/sign-in");
        }}
      />
    </div>
  );
}
