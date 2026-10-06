"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { shortReason } from "@/lib/checkout/reasons";
import { useCartStore } from "@/lib/stores/cart-store";

interface OrderView {
  id: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "EXPIRED";
  provider: "PAYSTACK" | "MPESA" | null;
  total: number;
  currency: string;
  failureReason: string | null;
  invoiceNumber: string | null;
  signedIn: boolean;
  claimable: boolean;
  buyer: { name: string; email: string; phone: string | null };
  items: { title: string }[];
}

const GIVE_UP_AFTER_MS = 5 * 60_000;
const box = "mx-auto min-h-[60vh] max-w-[620px] px-6 pb-24 pt-32 text-center text-navy md:pt-40";
const button = "mt-8 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold";

/** Confetti pouring down the page for a few seconds (off for people who asked for reduced motion). */
async function pourConfetti() {
  const { default: confetti } = await import("canvas-confetti");
  const end = Date.now() + 3500;
  const colors = ["#fdc105", "#0c2142", "#0f4fb1", "#f5f0e6"];
  (function frame() {
    confetti({ particleCount: 6, angle: 90, spread: 120, startVelocity: 18, gravity: 0.9, ticks: 300, origin: { x: Math.random(), y: -0.1 }, colors, disableForReducedMotion: true, zIndex: 9999 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** The thank-you page. Shows only what the server reports; polls until the order is final. */
export function SuccessView({ reference }: { reference: string }) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const clearCart = useCartStore((s) => s.clear);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;
    let delay = 2000;
    const startedAt = Date.now();
    let claimToken: string | null = null;
    try {
      claimToken = sessionStorage.getItem(`wg:claim:${reference}`);
    } catch {
      /* private mode */
    }
    const suffix = claimToken ? `?t=${encodeURIComponent(claimToken)}` : "";

    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(reference)}${suffix}`, { cache: "no-store" });
        if (res.status === 404) return !cancelled && setMissing(true);
        if (res.ok) {
          let data = (await res.json()) as OrderView;
          if (cancelled) return;
          // A new account whose session was not claimed yet (for example the page was opened fresh): claim it once.
          if (data.status === "PAID" && data.claimable && claimToken) {
            await fetch("/api/auth/checkout/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.id, token: claimToken }) }).catch(() => null);
            const again = await fetch(`/api/orders/${encodeURIComponent(reference)}${suffix}`, { cache: "no-store" }).catch(() => null);
            if (again?.ok) data = (await again.json()) as OrderView;
          }
          if (cancelled) return;
          setToken(claimToken);
          setOrder(data);
          if (data.status !== "PENDING") {
            if (data.status === "PAID") {
              clearCart();
              void pourConfetti();
            }
            return;
          }
        }
      } catch {
        /* network blip: try again */
      }
      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) return !cancelled && setTimedOut(true);
      delay = Math.min(delay * 1.4, 10_000);
      if (!cancelled) setTimeout(tick, delay);
    }
    void tick();
    return () => {
      cancelled = true;
    };
  }, [reference, clearCart]);

  if (!reference || missing) {
    return (
      <div className={box}>
        <h1 className="font-display text-3xl">We could not find that order</h1>
        <p className="mt-3 text-navy/70">If you just paid, check your email for the receipt, or sign in to see your books.</p>
        <Link href="/sign-in" className={button}>
          Sign in
        </Link>
      </div>
    );
  }

  if (order?.status === "PAID") {
    const invoiceHref = `/api/orders/${order.id}/invoice${token ? `?t=${encodeURIComponent(token)}` : ""}`;
    return (
      <div className={box} role="status">
        <h1 className="font-display text-4xl text-green md:text-5xl">Payment received</h1>
        <p className="mt-3 text-lg text-navy/70">
          Thank you, {order.buyer.name.split(" ")[0]}. <strong>{order.items.map((i) => i.title).join(", ")}</strong> has been added to your account.
        </p>

        {order.signedIn ? (
          <>
            <p className="mt-4 text-navy/70">You are already signed in on this device.</p>
            <Link href="/dashboard" className={button}>
              Go to dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 text-navy/70">Sign in with a code sent to your email to open your books.</p>
            <Link href={`/sign-in?redirect=/dashboard`} className={button}>
              Sign in to your dashboard
            </Link>
          </>
        )}

        <div className="mx-auto mt-10 max-w-md rounded-2xl bg-white p-5 text-left text-sm text-navy/80">
          <h2 className="font-medium text-navy">Signing in next time</h2>
          <p className="mt-2">
            There is no password. Use the email <strong>{order.buyer.email}</strong>
            {order.buyer.phone ? (
              <>
                {" "}
                or the phone number <strong>{order.buyer.phone}</strong>
              </>
            ) : null}{" "}
            you checked out with. We send a 4-digit code, you enter it, and you are in. Use the user icon at the top right of any page.
          </p>
        </div>

        <p className="mt-6 text-sm text-navy/60">
          A receipt and invoice were sent to your email, and a text message to your phone.{" "}
          <a href={invoiceHref} className="underline underline-offset-4 hover:text-gold">
            Download the invoice (PDF)
          </a>
          {order.invoiceNumber ? ` · ${order.invoiceNumber}` : ""}
        </p>
      </div>
    );
  }

  if (order?.status === "FAILED" || order?.status === "EXPIRED") {
    return (
      <div className={box} role="status">
        <h1 className="font-display text-3xl">The payment did not go through</h1>
        <p className="mt-3 text-navy/70">{shortReason(order.failureReason)} You have not been charged for this order.</p>
        <Link href="/checkout" className={button}>
          Try again
        </Link>
      </div>
    );
  }

  if (order?.status === "REFUNDED") {
    return (
      <div className={box} role="status">
        <h1 className="font-display text-3xl">This order was refunded</h1>
      </div>
    );
  }

  return (
    <div className={box} role="status" aria-live="polite">
      <h1 className="font-display text-3xl">{timedOut ? "Still waiting for confirmation" : "Confirming your payment..."}</h1>
      <p className="mt-3 text-navy/70">{order?.provider === "MPESA" ? "Check your phone and enter your M-Pesa PIN. This page updates by itself." : "This usually takes a few seconds. This page updates by itself."}</p>
      {timedOut && (
        <p className="mt-4 text-navy/70">
          If you were charged, your book will appear in your account shortly. If it does not, <Link href="/contact" className="underline">contact us</Link> with this reference: {reference}.
        </p>
      )}
    </div>
  );
}
