"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { FillButton } from "@/components/ui/FillButton";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { BOOK_HREF, NAVBAR_LINKS } from "@/lib/content/landing";
import { cn } from "@/lib/cn";
import { useHydrated } from "@/lib/hooks/use-hydrated";
import { useCartStore } from "@/lib/stores/cart-store";

/**
 * Fixed navbar. Transparent over the hero (`#hero`); once the hero has
 * scrolled away it becomes an off-white glass pill (Get My Book included,
 * as an outlined spill-fill button). Pages without a `#hero` stay glass.
 *
 * Book pages (`/store/*`) and `/cart` get the full-width variant instead of
 * the floating pill: a search input plus a cart icon (with item count) at the
 * far right, and no Get My Book CTA.
 */
export function Navbar() {
  const pathname = usePathname();
  const full = pathname.startsWith("/store/") || pathname === "/cart";
  const hasHero = pathname === "/" || pathname.startsWith("/store/");
  // Path whose hero has scrolled away. Keyed by path because this navbar persists across
  // client-side navigations: a plain boolean would carry the previous page's state over.
  const [pastHeroPath, setPastHeroPath] = useState<string | null>(null);
  const pastHero = pastHeroPath === pathname;
  const [open, setOpen] = useState(false);
  const solid = !hasHero || pastHero;
  const hydrated = useHydrated();
  const cartCount = useCartStore((s) => s.items.reduce((n, i) => n + i.qty, 0));

  useEffect(() => {
    const hero = hasHero ? document.getElementById("hero") : null;
    if (!hero) return;
    const io = new IntersectionObserver(
      // Batched entries are oldest-first; only the latest state matters.
      (entries) => setPastHeroPath(entries[entries.length - 1].isIntersecting ? null : pathname),
      { rootMargin: "-90px 0px 0px 0px" },
    );
    io.observe(hero);
    return () => io.disconnect();
  }, [hasHero, pathname]);

  const linkClass =
    "text-xl font-light tracking-[0.03em] transition-opacity hover:opacity-70";

  const cart = (
    <Link
      href="/cart"
      aria-label={hydrated && cartCount > 0 ? `Cart, ${cartCount} items` : "Cart"}
      className="relative grid size-11 place-items-center transition-opacity hover:opacity-70"
    >
      <MaskIcon name="iconamoon--shopping-bag-light" size={36} />
      {hydrated && cartCount > 0 && (
        <span className="absolute right-0 top-0 grid min-w-5 place-items-center rounded-full bg-gold px-1 text-xs font-medium leading-5 text-white">
          {cartCount}
        </span>
      )}
    </Link>
  );

  return (
    <header className={cn("fixed inset-x-0 top-0 z-50", !full && "px-4 pt-4 md:pt-6")}>
      <nav
        aria-label="Main"
        className={cn(
          "relative flex items-center justify-between transition-[background-color,box-shadow,color,border-color,padding] duration-500",
          full
            ? cn(
                "px-6 md:gap-8 md:px-[6vw]",
                // Sits lower (Figma: 44px from the top) while transparent over the hero; back up once it has a background.
                solid ? "py-3 md:py-4" : "pb-3 pt-6 md:pb-4 md:pt-11",
              )
            : "rounded-full px-6 py-2.5 md:ml-[calc(10.7vw-1.5rem)] md:w-[52vw] md:min-w-[720px] md:max-w-[860px]",
          solid
            ? cn(
                "border border-navy/10 bg-cream/70 text-navy backdrop-blur-xl",
                full ? "border-x-0 border-t-0" : "shadow-[0_8px_30px_rgb(12_33_66/0.08)]",
              )
            : "border border-transparent bg-transparent text-cream",
        )}
      >
        <ul className="hidden items-center gap-x-8 md:flex lg:gap-x-10">
          {NAVBAR_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={linkClass}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        {full ? (
          <div className="ml-auto hidden items-center gap-8 md:flex">
            {/* ponytail: visual only; wire to /api/search once there is a results page. Hidden below lg: it doesn't fit beside the links. */}
            <div role="search" className="relative hidden w-[min(420px,30vw)] lg:block">
              <input
                type="search"
                aria-label="Search"
                placeholder="Search for anything..."
                className={cn(
                  "h-[50px] w-full rounded-[45px] border-2 bg-transparent pl-7 pr-14 text-[15px] transition-colors duration-500 focus:border-gold focus:ring-0",
                  solid
                    ? "border-navy/40 text-navy placeholder:text-navy/50"
                    : "border-white text-white placeholder:text-white/65",
                )}
              />
              <MaskIcon
                name="bitcoin-icons--search-filled"
                size={37}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gold"
              />
            </div>
            {cart}
          </div>
        ) : (
          <div className="hidden md:block">
            {solid ? (
              <FillButton href={BOOK_HREF} className="py-2 text-lg">
                Get My Book
              </FillButton>
            ) : (
              <Link
                href={BOOK_HREF}
                className="flex items-center gap-1 text-xl tracking-[0.05em] underline decoration-[7.5%] underline-offset-4"
              >
                Get My Book <MaskIcon name="solar--arrow-right-up-line-duotone" className="text-gold" />
              </Link>
            )}
          </div>
        )}

        {/* Mobile */}
        <span className="text-lg font-medium md:hidden">Wangeci</span>
        <div className="flex items-center gap-1 md:hidden">
          {full && cart}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className="grid size-10 place-items-center"
          >
            <span className="flex w-6 flex-col gap-1.5">
              <span className={cn("h-0.5 bg-current transition-transform", open && "translate-y-2 rotate-45")} />
              <span className={cn("h-0.5 bg-current transition-opacity", open && "opacity-0")} />
              <span className={cn("h-0.5 bg-current transition-transform", open && "-translate-y-2 -rotate-45")} />
            </span>
          </button>
        </div>

        <AnimatePresence>
          {open && (
            <motion.ul
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="absolute inset-x-0 top-full mt-2 flex flex-col gap-4 rounded-3xl border border-navy/10 bg-cream/90 p-6 text-navy shadow-lg backdrop-blur-xl md:hidden"
            >
              {NAVBAR_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} onClick={() => setOpen(false)} className="text-xl font-light">
                    {l.label}
                  </Link>
                </li>
              ))}
              {!full && (
                <li>
                  <FillButton href={BOOK_HREF}>Get My Book</FillButton>
                </li>
              )}
            </motion.ul>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
