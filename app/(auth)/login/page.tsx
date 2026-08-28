"use client";

/**
 * /login — passwordless redesign (supersedes the old email+password
 * build; see the plan's §2A "Passwordless auth redesign").
 *
 * Full-screen edge-to-edge split layout: 100vw×100vh, no outer card, no
 * drop shadow, no cream page backdrop. This is a deliberately different
 * treatment from `components/layout/AuthShell.tsx` (the floating
 * card-style shell `/signup` still uses) — see the judgment-call note
 * below.
 *
 * There's no password field anywhere. "Continue" only collects an email,
 * kicks off `authClient.emailOtp.sendVerificationOtp(...)`, and opens
 * `TwoFactorModal` pre-set to email/code-entry — the modal owns the rest
 * of the sign-in flow (method choice, OTP entry, verify).
 *
 * Judgment call — AuthShell: rather than adding a `variant="fullbleed"`
 * prop to `AuthShell` (which `/signup`, and potentially future
 * `/verify`/`/reset-password` pages, still use in its original
 * card-on-cream-backdrop form), this page builds its own inline layout.
 * The two treatments share almost nothing structurally (100vw/100vh grid
 * vs. a centered max-w-5xl card; a 4-5 slide cross-fading carousel vs. a
 * static graphic panel; a pinned top-left mark vs. a mark inline with the
 * form column), so threading both through one component via a variant
 * flag would mostly be an if/else fork with little shared code — not
 * worth the coupling risk to a shell other pages still rely on.
 */
import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AppIcon } from "@/lib/icons";
import { authClient } from "@/lib/auth-client";
import { AuthCarousel } from "@/components/auth/AuthCarousel";
import { TwoFactorModal } from "@/components/auth/TwoFactorModal";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Email is required");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);
    setSending(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: trimmed,
        type: "sign-in",
      });
      if (error) {
        // Expected until the backend session wires up the emailOTP
        // plugin (see lib/auth-client.ts) — the modal still opens so the
        // OTP-entry UI stays exercisable ahead of that landing.
        console.warn("[login] sendVerificationOtp failed", error);
      }
    } catch (err) {
      console.warn("[login] sendVerificationOtp threw", err);
    } finally {
      setSending(false);
      setModalOpen(true);
    }
  }

  function handleOAuthClick(provider: string) {
    // UI-only for this phase — no real OAuth wiring yet.
    console.info(`[login] OAuth click: ${provider} (not wired up)`);
  }

  function handleVerified() {
    queryClient.invalidateQueries({ queryKey: ["session"] });
    router.push("/dashboard");
  }

  return (
    <div className="grid h-screen w-screen grid-cols-1 overflow-hidden md:grid-cols-[46%_54%]">
      {/* Left column */}
      <div className="relative flex flex-col bg-white p-6 md:p-0">
        {/* Pinned top-left mark */}
        <Link
          href="/"
          className="static mb-8 inline-flex w-fit items-center gap-3 md:absolute md:left-10 md:top-10 md:mb-0"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy">
            <AppIcon icon="lucide:book-open" size={18} className="text-gold" />
          </span>
          <span className="text-base font-medium text-navy">
            Wangeci Kariuki
          </span>
        </Link>

        {/* Centered content block */}
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[400px]">
            {/* Pill tab switcher */}
            <div className="inline-flex w-fit items-center gap-1 rounded-full bg-gray-light p-1">
              <span className="rounded-full bg-white px-5 py-2 text-sm font-medium text-navy shadow-sm">
                Sign In
              </span>
              <Link
                href="/signup"
                className="rounded-full px-5 py-2 text-sm font-medium text-gray transition-colors duration-150 hover:text-navy"
              >
                Sign Up
              </Link>
            </div>

            <h1 className="mt-6 text-[32px] leading-tight font-bold text-navy">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-gray">
              Sign in to continue your reading journey.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-8">
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-navy"
              >
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                aria-invalid={Boolean(emailError)}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-line px-4 py-3 text-navy outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-gray focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,166,22,0.15)]"
              />
              {emailError && (
                <p className="mt-1.5 text-sm" style={{ color: "#B4321F" }}>
                  {emailError}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-blue text-base font-medium text-white transition-colors duration-150 hover:bg-blue-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sending ? (
                  <AppIcon
                    icon="lucide:loader-circle"
                    size={20}
                    className="animate-spin"
                  />
                ) : (
                  "Continue"
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs font-medium tracking-[0.05em] text-gray uppercase">
                Or Continue With
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Continue with Google"
                onClick={() => handleOAuthClick("Google")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-gold"
              >
                <AppIcon icon="logos:google-icon" size={20} />
              </button>
              <button
                type="button"
                aria-label="Continue with Apple"
                onClick={() => handleOAuthClick("Apple")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-gold"
              >
                <AppIcon icon="ic:baseline-apple" size={20} className="text-black" />
              </button>
              <button
                type="button"
                aria-label="Continue with Facebook"
                onClick={() => handleOAuthClick("Facebook")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-gold"
              >
                <AppIcon icon="logos:facebook" size={20} />
              </button>
            </div>

            <p className="mt-8 text-center text-[13px] text-gray">
              New here?{" "}
              <Link
                href="/signup"
                className="font-medium text-gold hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right column — hidden below md, per spec */}
      <div
        className="relative hidden overflow-hidden md:block"
        style={{ background: "linear-gradient(160deg, #0C2142 0%, #0F4FB1 100%)" }}
      >
        {/* Bottom layer: dot-grid texture, white ~4% opacity, ~24px spacing. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <AuthCarousel />
      </div>

      {modalOpen && (
        <TwoFactorModal
          onClose={() => setModalOpen(false)}
          email={email.trim()}
          initialStep="code"
          initialMethod="email"
          onVerified={handleVerified}
        />
      )}
    </div>
  );
}
