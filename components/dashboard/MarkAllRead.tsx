"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        setBusy(false);
        router.refresh();
      }}
      className="rounded-full border border-black/20 px-4 py-1.5 text-sm hover:border-navy disabled:opacity-50"
    >
      Mark all as read
    </button>
  );
}
