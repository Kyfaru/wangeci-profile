"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PhoneField, toE164 } from "@/components/auth/PhoneField";
import { TurnstileWidget, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import { PaymentModal, type PayModalState } from "@/components/checkout/PaymentModal";
import { inputClass, primaryButton } from "@/lib/auth/client-actions";
import { cn } from "@/lib/cn";
import { shortReason } from "@/lib/checkout/reasons";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import type { ProviderId } from "@/lib/payments/types";
import { useCartStore } from "@/lib/stores/cart-store";

interface QuoteView {
  items: { editionId: string; title: string; price: number; currency: string }[];
  subtotal: number;
  discount: number;
  fee: number;
  total: number;
  currency: string;
  couponCode: string | null;
  couponError: string | null;
}

export interface SignedInBuyer {
  name: string;
  email: string;
  phone: string | null;
}

const RETRY_AFTER_FAILURE_MS = 15_000;
const POLL_EVERY_MS = 3_000;
const GIVE_UP_AFTER_MS = 3 * 60_000;

const money = (n: number, c: string) => `${c} ${n.toLocaleString("en-KE", { minimumFractionDigits: n % 1 ? 2 : 0 })}`;
const ERROR_ID = "checkout-error";
const label = "text-sm font-medium text-navy/80";

/**
 * Checkout. Section 1: who is buying (an account is made from these details). Section 2: how to pay,
 * with the live summary beside it. Prices always come from the server (/api/checkout/quote); the browser
 * sends only edition ids, a coupon code and the buyer's own details.
 */
export function CheckoutClient({
  savedEditionIds,
  signedIn,
  methods,
  turnstileSiteKey,
}: {
  savedEditionIds: string[];
  signedIn: SignedInBuyer | null;
  methods: ProviderId[];
  turnstileSiteKey?: string;
}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const cartItems = useCartStore((s) => s.items);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [dial, setDial] = useState("+254");
  const [number, setNumber] = useState("");
  const [method, setMethod] = useState<"card" | "mpesa">(methods.includes("PAYSTACK") ? "card" : "mpesa");
  const [mpesaOther, setMpesaOther] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | undefined>();
  const [quote, setQuote] = useState<QuoteView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"name" | "email" | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // bumped by "Retry" to reload the quote
  const [notice, setNotice] = useState<string | null>(null);
  const abandoned = useRef(false); // the buyer chose "Cancel and check later": stop reacting to this order
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [modal, setModal] = useState<PayModalState>({ phase: "idle", method: "card" });
  const widget = useRef<TurnstileHandle>(null);

  const ids = useMemo(() => [...new Set([...cartItems.filter((i) => i.editionId).map((i) => i.editionId as string), ...savedEditionIds])], [cartItems, savedEditionIds]);

  const canPay = methods.includes("PAYSTACK") || methods.includes("MPESA");

  const loadQuote = useCallback(
    async (code?: string) => {
      const res = await fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ editionIds: ids, coupon: code }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not load your order.");
      return data as QuoteView;
    },
    [ids],
  );

  useEffect(() => {
    if (!hydrated || ids.length === 0) return;
    let cancelled = false;
    loadQuote(coupon)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        setQuoteError(null);
      })
      .catch((e: Error) => !cancelled && setQuoteError(e.message));
    return () => {
      cancelled = true;
    };
  }, [hydrated, ids, coupon, loadQuote, attempt]);

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    setError(null);
    try {
      const q = await loadQuote(code);
      if (q.couponError) return setError(q.couponError);
      setCoupon(code);
      setQuote(q);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function reject(message: string, field: "name" | "email" | null = null) {
    setError(message);
    setErrorField(field);
  }

  function fail(reason: string, extra: Partial<PayModalState> = {}) {
    setBusy(false);
    setModal({ phase: "failed", method, reason, retryAt: Date.now() + RETRY_AFTER_FAILURE_MS, ...extra });
  }

  /** The buyer stops watching a slow payment. The order stays PENDING and the server-side reconcile settles it. */
  function checkLater() {
    abandoned.current = true;
    setBusy(false);
    setModal({ phase: "idle", method });
    setNotice("Your payment is still being confirmed. We will email you once it is done, and your book will appear in your dashboard.");
  }

  /** Waits for the server (never the browser) to say PAID or FAILED, then moves the modal on. */
  async function waitForResult(orderId: string, claimToken: string | null) {
    const started = Date.now();
    const headers: Record<string, string> = claimToken ? { "x-order-token": claimToken } : {};
    while (Date.now() - started < GIVE_UP_AFTER_MS) {
      await new Promise((r) => setTimeout(r, POLL_EVERY_MS));
      if (abandoned.current) return;
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, { cache: "no-store", headers }).catch(() => null);
      if (!res?.ok || abandoned.current) continue;
      const order = (await res.json()) as { status: string; failureReason: string | null; claimable: boolean };
      if (order.status === "PAID") return void (await succeed(orderId, claimToken, order.claimable));
      if (order.status === "FAILED" || order.status === "EXPIRED") return fail(shortReason(order.failureReason));
    }
    if (!abandoned.current) fail("We did not get a reply in time.");
  }

  async function succeed(orderId: string, claimToken: string | null, claimable: boolean) {
    // A brand-new account: this device claims its one session now that the payment is confirmed.
    if (claimable && claimToken) await fetch("/api/auth/checkout/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, token: claimToken }) }).catch(() => null);
    setModal({ phase: "success", method }); // the cart is emptied by the thank-you page once it sees the order PAID
    setTimeout(() => router.push(`/checkout/success?ref=${encodeURIComponent(orderId)}`), 1800);
  }

  async function pay() {
    setError(null);
    setErrorField(null);
    setNotice(null);
    if (!quote || quote.items.length === 0 || !canPay) return;

    let buyer: { firstName: string; lastName: string; email: string; phone: string } | undefined;
    if (!signedIn) {
      const phone = toE164(dial, number);
      if (!first.trim() || !last.trim()) return reject("Enter your first and last name.", "name");
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) return reject("Enter a valid email address.", "email");
      if (!phone) return reject("Enter a valid phone number.");
      if (turnstileSiteKey && !token) return reject("Please complete the security check.");
      buyer = { firstName: first.trim(), lastName: last.trim(), email: email.trim(), phone };
    }

    abandoned.current = false;
    setBusy(true);
    setModal({ phase: "idle", method });
    const mpesaPhone = method === "mpesa" && mpesaOther.trim() ? toE164("+254", mpesaOther) ?? undefined : undefined;
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editionIds: quote.items.map((i) => i.editionId), method, coupon, buyer, mpesaPhone, turnstileToken: token ?? undefined }),
    }).catch(() => null);
    widget.current?.reset();
    setToken(null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string; requestId?: string; code?: string; retryAfterSeconds?: number; contactSupport?: boolean; orderId?: string; free?: boolean; claimToken?: string | null; accessCode?: string | null; publicKey?: string } | undefined;
    if (!res || !data) return fail("Could not reach the server.");

    if (!res.ok) {
      if (data.code === "PAY_LOCKED") return fail(data.error ?? "Too many attempts.", { requestId: data.requestId, retryAt: Date.now() + (data.retryAfterSeconds ?? 0) * 1000, contactSupport: data.contactSupport });
      setBusy(false);
      return setError(`${data.error ?? "Something went wrong. Please try again."}${data.requestId ? ` (Reference: ${data.requestId})` : ""}`);
    }

    const orderId = data.orderId!;
    const claimToken = data.claimToken ?? null;
    if (claimToken) {
      try {
        sessionStorage.setItem(`wg:claim:${orderId}`, claimToken); // so the thank-you page can still read the order if the claim is retried
      } catch {
        /* private mode: the modal already holds it in memory */
      }
    }

    if (data.free) return void (await succeed(orderId, claimToken, Boolean(claimToken)));

    if (method === "mpesa") {
      setModal({ phase: "processing", method, since: Date.now() });
      return void (await waitForResult(orderId, claimToken));
    }

    // Card: Paystack's popup runs on top of this page; we only trust what the SERVER says afterwards.
    try {
      const { default: PaystackPop } = await import("@paystack/inline-js");
      const pop = new PaystackPop();
      pop.resumeTransaction(data.accessCode!, {
        onSuccess: () => {
          setModal({ phase: "processing", method, since: Date.now() });
          void waitForResult(orderId, claimToken);
        },
        // Closing the popup is the buyer's choice, not a failure: no 15 s lock, retry is immediate.
        onCancel: () => fail("You closed the payment window.", { cancelled: true, retryAt: undefined }),
        onError: () => fail("The card payment could not start."),
      });
    } catch {
      fail("The card payment could not start.");
    }
  }

  if (!hydrated) {
    return (
      <div className="mx-auto min-h-[70vh] max-w-[1080px] px-6 pb-24 pt-32 md:pt-40" aria-hidden>
        <div className="h-12 w-56 animate-pulse rounded-xl bg-navy/10" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="h-72 animate-pulse rounded-[24px] bg-navy/10" />
          <div className="h-72 animate-pulse rounded-[24px] bg-navy/10" />
        </div>
      </div>
    );
  }
  const empty = ids.length === 0 || (quote && quote.items.length === 0);

  return (
    <div className="mx-auto min-h-[70vh] max-w-[1080px] px-6 pb-24 pt-32 md:pt-40">
      <h1 className="font-display text-4xl text-navy md:text-5xl">Checkout</h1>

      {empty ? (
        <div className="mt-8">
          <p className="text-xl text-navy/70">There is nothing to pay for.</p>
          <Link href="/store" className="mt-6 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
            Browse the store
          </Link>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault(); // Enter in any field pays, through the same checks as the button
            void pay();
          }}
          className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]"
        >
          <div className="space-y-8">
            <section aria-labelledby="s1" className="rounded-[24px] bg-white p-6 md:p-8">
              <h2 id="s1" className="flex items-center gap-3 font-display text-2xl text-navy">
                <span className="grid size-8 place-items-center rounded-full bg-navy text-sm text-cream">1</span> Your details
              </h2>
              {signedIn ? (
                <p className="mt-4 text-navy/80">
                  Signed in as <strong>{signedIn.name}</strong> ({signedIn.email}). Your books will be added to this account.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-navy/60">We create your account from these details, so you can read and listen straight after paying.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className={label}>First name</span>
                      <input value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" aria-invalid={errorField === "name"} aria-describedby={errorField === "name" ? ERROR_ID : undefined} className={cn(inputClass, "mt-1")} />
                    </label>
                    <label className="block">
                      <span className={label}>Last name</span>
                      <input value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" aria-invalid={errorField === "name"} aria-describedby={errorField === "name" ? ERROR_ID : undefined} className={cn(inputClass, "mt-1")} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className={label}>Email</span>
                      <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" aria-invalid={errorField === "email"} aria-describedby={errorField === "email" ? ERROR_ID : undefined} className={cn(inputClass, "mt-1")} />
                    </label>
                    {/* PhoneField labels its own number input ("Phone number"), so no second label here. */}
                    <div className="sm:col-span-2">
                      <PhoneField dialCode={dial} number={number} onDialCode={setDial} onNumber={setNumber} />
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-navy/50">Already have an account with this email? Just pay: the book is added to it, then sign in with a code.</p>
                </>
              )}
            </section>

            <section aria-labelledby="s2" className="rounded-[24px] bg-white p-6 md:p-8">
              <h2 id="s2" className="flex items-center gap-3 font-display text-2xl text-navy">
                <span className="grid size-8 place-items-center rounded-full bg-navy text-sm text-cream">2</span> Payment method
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
                {methods.includes("PAYSTACK") && (
                  <label className={cn("cursor-pointer rounded-2xl border p-4 transition-colors", method === "card" ? "border-navy bg-cream/50" : "border-line hover:border-navy/40")}>
                    <input type="radio" name="method" value="card" checked={method === "card"} onChange={() => setMethod("card")} className="mr-2" />
                    Card
                    <span className="mt-1 block text-sm text-navy/60">Visa or Mastercard, secured by Paystack</span>
                  </label>
                )}
                {methods.includes("MPESA") && (
                  <label className={cn("cursor-pointer rounded-2xl border p-4 transition-colors", method === "mpesa" ? "border-navy bg-cream/50" : "border-line hover:border-navy/40")}>
                    <input type="radio" name="method" value="mpesa" checked={method === "mpesa"} onChange={() => setMethod("mpesa")} className="mr-2" />
                    M-Pesa
                    <span className="mt-1 block text-sm text-navy/60">A prompt is sent to your phone</span>
                  </label>
                )}
              </div>
              {!canPay && (
                <p role="alert" className="mt-4 text-error">
                  Payments are unavailable right now. Please try again later or <Link href="/contact" className="underline">contact us</Link>.
                </p>
              )}
              {method === "mpesa" && canPay && (
                <label className="mt-4 block">
                  <span className={label}>M-Pesa number (leave empty to use your phone number above)</span>
                  <input value={mpesaOther} onChange={(e) => setMpesaOther(e.target.value)} inputMode="tel" placeholder="0712 345 678" className={cn(inputClass, "mt-1")} />
                </label>
              )}
            </section>
          </div>

          <aside aria-labelledby="sum" className="h-fit rounded-[24px] bg-white p-6 lg:sticky lg:top-28">
            <h2 id="sum" className="font-display text-2xl text-navy">
              Order summary
            </h2>
            {quoteError && !quote ? (
              <div role="alert" className="mt-4">
                <p className="text-error">{quoteError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setQuoteError(null);
                    setAttempt((a) => a + 1);
                  }}
                  className="mt-3 rounded-2xl border border-navy px-4 py-2 text-navy transition-colors hover:bg-navy hover:text-cream"
                >
                  Retry
                </button>
              </div>
            ) : !quote ? (
              <p className="mt-4 text-navy/60">Loading your order...</p>
            ) : (
              <>
                <ul className="mt-4 divide-y divide-navy/10">
                  {quote.items.map((i) => (
                    <li key={i.editionId} className="flex justify-between gap-4 py-3 text-navy">
                      <span>{i.title}</span>
                      <span>{money(i.price, i.currency)}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex gap-2">
                  <input value={couponInput} onChange={(e) => setCouponInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyCoupon(); } }} placeholder="Coupon code" aria-label="Coupon code" className={cn(inputClass, "min-w-0 flex-1 uppercase")} />
                  <button type="button" onClick={applyCoupon} className="shrink-0 rounded-2xl border border-navy px-4 text-navy transition-colors hover:bg-navy hover:text-cream">
                    Apply
                  </button>
                </div>

                <dl className="mt-5 space-y-2 text-navy">
                  <div className="flex justify-between">
                    <dt>Subtotal</dt>
                    <dd>{money(quote.subtotal, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Discount{quote.couponCode ? ` (${quote.couponCode})` : ""}</dt>
                    <dd>{quote.discount > 0 ? `- ${money(quote.discount, quote.currency)}` : money(0, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Fees</dt>
                    <dd>{money(quote.fee, quote.currency)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-navy/15 pt-3 text-xl font-semibold">
                    <dt>Total</dt>
                    <dd>{money(quote.total, quote.currency)}</dd>
                  </div>
                </dl>

                {!signedIn && <div className="mt-4"><TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} /></div>}

                {(error || quoteError) && (
                  <p role="alert" id={ERROR_ID} className="mt-4 text-sm text-error">
                    {error ?? quoteError}
                  </p>
                )}
                {notice && (
                  <p role="status" className="mt-4 text-sm text-navy/80">
                    {notice}
                  </p>
                )}

                <button type="submit" disabled={busy || !canPay} data-umami-event="buy" className={cn(primaryButton, "mt-5")}>
                  {busy ? "Starting payment..." : quote.total === 0 ? "Get my book" : `Pay ${money(quote.total, quote.currency)}`}
                </button>
                <p className="mt-3 text-center text-xs text-navy/50">You are only charged once the payment provider confirms it.</p>
              </>
            )}
          </aside>
        </form>
      )}

      <PaymentModal
        state={modal}
        onCheckLater={checkLater}
        onClose={() => {
          setBusy(false);
          setModal({ phase: "idle", method });
        }}
        onRetry={() => {
          setModal({ phase: "idle", method });
          void pay();
        }}
      />
    </div>
  );
}
