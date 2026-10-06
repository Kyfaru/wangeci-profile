"use client";

import dynamic from "next/dynamic";

// Client-only: the flow lives in sessionStorage, which the server cannot see.
export const VerifyFlowClient = dynamic(() => import("@/components/auth/VerifyFlow").then((m) => m.VerifyFlow), {
  ssr: false,
  loading: () => <p className="text-navy/60">Loading...</p>,
});
