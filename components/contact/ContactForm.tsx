"use client";

import { useRef, useState } from "react";

import { TurnstileWidget, type TurnstileHandle } from "@/components/auth/TurnstileWidget";
import { inputClass, primaryButton } from "@/lib/auth/client-actions";

/** Public contact form (used on /contact and /services). Posts to /api/contact. */
export function ContactForm({ source, turnstileSiteKey }: { source: "/contact" | "/services"; turnstileSiteKey?: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const widget = useRef<TurnstileHandle>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, source, token: token ?? undefined, website }),
      });
      if (res.ok) {
        setSent(true);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        widget.current?.reset();
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status" className="rounded-2xl bg-white p-8 text-navy shadow-sm">
        <h3 className="font-display text-2xl">Message sent</h3>
        <p className="mt-2 text-navy/70">Thank you. We will reply to the email address you gave.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3" noValidate>
      <label className="block">
        <span className="sr-only">Your name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" required maxLength={100} className={inputClass} />
      </label>
      <label className="block">
        <span className="sr-only">Email address</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required maxLength={254} className={inputClass} />
      </label>
      <label className="block">
        <span className="sr-only">Your message</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="How can we help?" rows={6} required minLength={10} maxLength={3000} className={inputClass} />
      </label>
      {/* Honeypot: hidden from people and from screen readers; bots fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      <TurnstileWidget ref={widget} siteKey={turnstileSiteKey} onToken={setToken} />
      {error && (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || (Boolean(turnstileSiteKey) && !token)} className={primaryButton}>
        {busy ? "Sending..." : "Send message"}
      </button>
    </form>
  );
}
