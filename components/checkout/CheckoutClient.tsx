"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { inputClass, primaryButton } from "@/lib/auth/client-actions";
import { cn } from "@/lib/cn";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { ProviderId } from "@/lib/payments/types";
import { useCartStore } from "@/lib/stores/cart-store";

interface QuoteItem {
  editionId: string;
  title: string;
  price: number;
  currency: string;
}

const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-KE")}`;

/**
 * Checkout screen. The browser sends only edition ids and the chosen method. The prices shown come from
 * /api/cart/quote (the server), and the server re-reads them again when the order is created.
 */
export function CheckoutClient({ savedEditionIds, accountPhone, methods }: { savedEditionIds: string[]; accountPhone: string | null; methods: ProviderId[] }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const cartItems = useCartStore((s) => s.items);
  const [quote, setQuote] = useState<{ items: QuoteItem[]; total: number; currency: string } | null>(null);
  const [method, setMethod] = useState<"card" | "mpesa">("card");
  const [phone, setPhone] = useState(accountPhone?.replace(/^\+254/, "0") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The shopping list is the browser cart plus anything saved to the account at sign-in.
  const ids = useMemo(() => [...new Set([...cartItems.filter((i) => i.editionId).map((i) => i.editionId as string), ...savedEditionIds])], [cartItems, savedEditionIds]);

  useEffect(() => {
    if (!hydrated) return;
    if (ids.length === 0) return;
    let cancelled = false;
    fetch(`/api/cart/quote?ids=${encodeURIComponent(ids.join(","))}`)
      .then((r) => r.json())
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setError("Could not load your cart. Please refresh."));
    return () => {
      cancelled = true;
    };
  }, [hydrated, ids]);

  async function pay() {
    if (!quote || quote.items.length === 0) return;
    setBusy(true);
    setError(null);
    const digits = phone.replace(/\D/g, "").replace(/^0/, "254");
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionIds: quote.items.map((i) => i.editionId), method, phone: method === "mpesa" ? digits : undefined }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; redirectUrl?: string | null; reference?: string };
    if (!res.ok) {
      setBusy(false);
      return setError(data.error ?? "Something went wrong. Please try again.");
    }
    if (data.redirectUrl) window.location.assign(data.redirectUrl); // card: pay on Paystack's page
    else router.push(`/checkout/success?ref=${encodeURIComponent(data.reference ?? "")}`); // M-Pesa: wait for the phone prompt
  }

  if (!hydrated) return <div className="mx-auto min-h-[70vh] max-w-[760px] px-6 pb-24 pt-32 md:pt-40" />;

  const empty = ids.length === 0 || (quote && quote.items.length === 0);

  return (
    <div className="mx-auto min-h-[70vh] max-w-[760px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Checkout</h1>

      {empty ? (
        <div className="mt-8">
          <p className="text-xl text-navy/70">There is nothing to pay for.</p>
          <Link href="/store" className="mt-6 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
            Browse the store
          </Link>
        </div>
      ) : !quote ? (
        <p className="mt-8 text-navy/60">Loading your order...</p>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-navy/10 rounded-[24px] bg-white px-6">
            {quote.items.map((i) => (
              <li key={i.editionId} className="flex items-center justify-between py-4 text-lg text-navy">
                <span>{i.title}</span>
                <span className="font-medium">{money(i.price, i.currency)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between py-4 text-xl font-semibold text-navy">
              <span>Total</span>
              <span>{money(quote.total, quote.currency)}</span>
            </li>
          </ul>

          <fieldset className="mt-8">
            <legend className="text-lg font-medium text-navy">Pay with</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {methods.includes("PAYSTACK") && (
                <label className={cn("cursor-pointer rounded-2xl border p-4 transition-colors", method === "card" ? "border-navy bg-white" : "border-line bg-white/60 hover:border-navy/40")}>
                  <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} className="mr-2" />
                  Card
                  <span className="mt-1 block text-sm text-navy/60">Secure payment page by Paystack</span>
                </label>
              )}
              {methods.includes("MPESA") && (
                <label className={cn("cursor-pointer rounded-2xl border p-4 transition-colors", method === "mpesa" ? "border-navy bg-white" : "border-line bg-white/60 hover:border-navy/40")}>
                  <input type="radio" name="method" value="mpesa" checked={method === "mpesa"} onChange={() => setMethod("mpesa")} className="mr-2" />
                  M-Pesa
                  <span className="mt-1 block text-sm text-navy/60">A prompt is sent to your phone</span>
                </label>
              )}
            </div>
          </fieldset>

          {method === "mpesa" && (
            <label className="mt-4 block">
              <span className="text-sm text-navy/70">M-Pesa phone number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="0712 345 678" className={cn(inputClass, "mt-1")} />
            </label>
          )}

          {error && (
            <p role="alert" className="mt-4 text-sm text-error">
              {error}
            </p>
          )}

          <button type="button" onClick={pay} disabled={busy} className={cn(primaryButton, "mt-8")}>
            {busy ? "Starting payment..." : `Pay ${money(quote.total, quote.currency)}`}
          </button>
          <p className="mt-3 text-center text-sm text-navy/50">You are only charged once the payment provider confirms it.</p>
        </>
      )}
    </div>
  );
}
