"use client";

import { useState, type FormEvent } from "react";

const field = "mt-1 w-full rounded-xl border-black/20 text-sm";

/** Two small plain-text forms for a book page: a comment (held for review) and feedback. Shown only to signed-in readers. */
export function CommunityForms({ slug, signedIn }: { slug: string; signedIn: boolean }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  if (!signedIn) {
    return <p className="mt-4 text-sm text-black/60"><a href="/sign-in" className="underline">Sign in</a> to leave a comment or feedback.</p>;
  }

  async function send(event: FormEvent<HTMLFormElement>, kind: "comment" | "feedback") {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const rating = Number(data.get("rating"));
    const payload =
      kind === "comment"
        ? { kind, slug, body: String(data.get("text") ?? "") }
        : { kind, slug, message: String(data.get("text") ?? ""), ...(rating >= 1 && rating <= 5 ? { rating } : {}) };
    setPending(true);
    try {
      const res = await fetch("/api/community", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        form.reset();
        setMessage({ ok: true, text: kind === "comment" ? "Thank you. Your comment will appear once it has been reviewed." : "Thank you for your feedback." });
      } else {
        setMessage({ ok: false, text: json.error ?? "Something went wrong. Please try again." });
      }
    } catch {
      setMessage({ ok: false, text: "Could not reach the server. Please try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <form onSubmit={(e) => send(e, "comment")} className="space-y-2">
        <label className="block text-sm text-black/70">
          Leave a comment
          <textarea name="text" required minLength={2} maxLength={1000} rows={4} className={field} />
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-navy px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gold disabled:opacity-50">Post comment</button>
      </form>
      <form onSubmit={(e) => send(e, "feedback")} className="space-y-2">
        <label className="block text-sm text-black/70">
          Feedback for the author
          <textarea name="text" required minLength={2} maxLength={2000} rows={4} className={field} />
        </label>
        <label className="block text-sm text-black/70">
          Rating (optional)
          <select name="rating" className={field} defaultValue="">
            <option value="">No rating</option>
            {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} of 5</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending} className="rounded-full bg-navy px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-gold disabled:opacity-50">Send feedback</button>
      </form>
      {message && <p role="status" className={`text-sm md:col-span-2 ${message.ok ? "text-green" : "text-error"}`}>{message.text}</p>}
    </div>
  );
}
