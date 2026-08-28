"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/hooks/use-session";
import { useCartStore } from "@/lib/stores/cart-store";
import { Avatar, Button } from "@/components/ui";
import { CartIcon, CloseIcon, MenuIcon } from "./icons";

export interface NavbarProps {
  className?: string;
}

interface NavLink {
  href: string;
  label: string;
}

const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/store", label: "Store" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/blog", label: "Blog" },
];

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The "About" link is a smooth-scroll anchor to the Home page's own
 * `id="about"` section when already on "/" (it's the same section, not a
 * separate page there) — everywhere else it's a normal navigation to
 * `/about`. `href` stays `/about` in both cases so it degrades gracefully
 * without JS.
 */
function handleAboutLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  pathname: string,
) {
  if (pathname !== "/") return;
  const target = document.getElementById("about");
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: "smooth" });
}

/**
 * Top marketing-site navigation. Session-aware (Login/Signup vs. an account
 * link), active-link styling via `usePathname`, and a cart badge from
 * `useCartStore`.
 *
 * No sign-out control is rendered — there's no logout endpoint yet (only
 * `/api/auth/{login,signup,session}` exist). The account affordance just
 * links into the dashboard; wiring a real sign-out is a follow-up once the
 * backend exposes it.
 */
export function Navbar({ className }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isLoading } = useSession();
  const cartCount = useCartStore((state) => state.totalItems());
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = session?.user;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-navy/10 bg-cream/95 backdrop-blur",
        className,
      )}
    >
      <div className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-6 lg:px-12">
        <Link
          href="/"
          className="font-display text-xl tracking-tight text-navy"
        >
          Wangechi Kariuki
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 lg:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={
                  link.href === "/about"
                    ? (event) => handleAboutLinkClick(event, pathname)
                    : undefined
                }
                className={cn(
                  "relative py-2 text-sm font-medium text-navy/70 transition-colors hover:text-navy",
                  active && "text-navy after:absolute after:-bottom-0.5 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-gold-bright",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/cart"
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="relative inline-flex size-10 items-center justify-center rounded-full text-navy transition-colors hover:bg-navy/5"
          >
            <CartIcon className="size-5" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 inline-flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold-bright px-1 text-[10px] font-bold text-navy">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            {isLoading ? (
              <div className="size-9 animate-pulse rounded-full bg-navy/10" />
            ) : user ? (
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full py-1 pr-1 pl-3 transition-colors hover:bg-navy/5"
              >
                <span className="text-sm font-medium text-navy">
                  {user.name.split(" ")[0]}
                </span>
                <Avatar src={user.avatar} alt={user.name} size="sm" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-sm font-medium text-navy/70 transition-colors hover:text-navy"
                >
                  Login
                </Link>
                <Button size="sm" onClick={() => router.push("/signup")}>
                  Sign up
                </Button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="inline-flex size-10 items-center justify-center rounded-full text-navy hover:bg-navy/5 lg:hidden"
          >
            {mobileOpen ? (
              <CloseIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-navy/10 bg-cream px-6 pb-6 lg:hidden">
          <nav aria-label="Primary" className="flex flex-col gap-1 pt-4">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={(event) => {
                    if (link.href === "/about") {
                      handleAboutLinkClick(event, pathname);
                    }
                    setMobileOpen(false);
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-3 py-2.5 text-base font-medium text-navy/70",
                    active && "bg-navy/5 text-navy",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 flex flex-col gap-2 border-t border-navy/10 pt-4">
            {isLoading ? null : user ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  setMobileOpen(false);
                  router.push("/dashboard");
                }}
              >
                Go to dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/login");
                  }}
                >
                  Login
                </Button>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setMobileOpen(false);
                    router.push("/signup");
                  }}
                >
                  Sign up
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
