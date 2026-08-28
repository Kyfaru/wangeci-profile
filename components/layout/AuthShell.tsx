import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { BookIcon } from "./icons";

export interface AuthShellProps {
  /** The actual form (login/signup/verify/reset-password). */
  children: ReactNode;
  /** Heading shown above the form slot, e.g. "Welcome back". */
  title?: string;
  description?: string;
  /**
   * Highlights the matching pill in the Sign In / Sign Up switcher shown
   * above the form. Omit on pages that don't belong in that pair (e.g. a
   * future `/verify` or `/reset-password`) to hide the switcher entirely.
   */
  activeTab?: "login" | "signup";
  className?: string;
}

const AUTH_TABS = [
  { key: "login", label: "Sign In", href: "/login" },
  { key: "signup", label: "Sign Up", href: "/signup" },
] as const;

/**
 * Split-screen shell for the auth pages (login/signup/verify/reset-password).
 *
 * Layout follows the reference spec closely: a floating white card
 * (max-w-5xl, rounded, shadowed) centered on a cream page background,
 * split ~50/50 into a form panel and a navy graphic panel — rather than
 * the previous edge-to-edge full-bleed split. This is the one auth page
 * with an exact visual spec to hit; other auth routes reuse this same
 * shell for consistency.
 *
 * Right-panel judgment call: no illustration asset or brand photography
 * exists yet (per the plan), so this uses a navy/gold gradient with a
 * stylized book-cover placeholder card + tagline instead of inventing
 * photography or illustration. Treat this as a considered placeholder,
 * not a final pixel-perfect decision — it's hidden below `lg` so auth
 * forms stay full-width on mobile.
 */
export function AuthShell({
  children,
  title,
  description,
  activeTab,
  className,
}: AuthShellProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen items-center justify-center bg-cream px-4 py-8 sm:px-8 sm:py-12",
        className,
      )}
    >
      <div className="flex w-full max-w-5xl overflow-hidden rounded-card bg-white shadow-2xl lg:min-h-[680px]">
        {/* Form panel */}
        <div className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-1/2 lg:px-14 lg:py-14">
          <div className="mx-auto flex w-full max-w-md flex-col justify-center">
            <Link
              href="/"
              className="mb-10 inline-flex w-fit items-center gap-3"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-navy text-gold-bright">
                <BookIcon className="size-4" />
              </span>
              <span className="font-display text-lg text-navy">
                Wangechi Kariuki
              </span>
            </Link>

            {activeTab && (
              <div className="mb-8 inline-flex w-fit items-center gap-1 rounded-full bg-gray-light p-1">
                {AUTH_TABS.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={cn(
                      "rounded-full px-5 py-2 text-sm font-medium transition-colors duration-150",
                      activeTab === tab.key
                        ? "bg-white text-navy shadow-sm"
                        : "text-gray hover:text-navy",
                    )}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            )}

            {(title || description) && (
              <div className="mb-8 space-y-2">
                {title && (
                  <h1 className="font-display text-3xl text-navy">{title}</h1>
                )}
                {description && (
                  <p className="text-sm text-gray">{description}</p>
                )}
              </div>
            )}

            {children}
          </div>
        </div>

        {/* Graphic panel — stylized placeholder, see file header */}
        <div className="relative hidden overflow-hidden bg-navy lg:block lg:w-1/2">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(160deg, var(--color-navy) 0%, #081527 100%)",
            }}
          />
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(245,240,230,0.16) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 78% 18%, rgba(253,193,5,0.28), transparent 55%)",
            }}
          />
          <div className="relative z-10 flex h-full flex-col items-center justify-center gap-8 px-12 text-center text-cream">
            <div className="flex h-64 w-56 flex-col items-center justify-center gap-4 rounded-card border border-gold/40 bg-white/5 p-6 shadow-2xl backdrop-blur-sm">
              <span className="text-xs font-semibold tracking-[0.12em] text-gold-bright uppercase">
                Felister Wangechi Kariuki
              </span>
              <div className="h-px w-10 bg-gold/40" />
              <span className="font-display text-2xl leading-snug">
                From Pieces To Power
              </span>
            </div>
            <p className="max-w-xs text-sm text-cream/70">
              A memoir of rebuilding — from fragments to full strength, one
              page at a time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
