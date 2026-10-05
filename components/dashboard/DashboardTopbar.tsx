import Link from "next/link";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { NAVBAR_LINKS } from "@/lib/content/landing";

const LINKS = NAVBAR_LINKS.filter((l) => l.href !== "/"); // dashboard topbar has no "Home" link (Figma)

/** Top bar for `/dashboard/*` pages — search + marketing nav links, no cart/CTA (Figma: "My dashboard" frame). */
export function DashboardTopbar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-[rgba(199,221,255,0.15)] px-6 py-5 md:px-10">
      <div role="search" className="relative w-full max-w-[420px]">
        {/* ponytail: visual only, same as the marketing Navbar's search input — wire to /api/search once there is a results page. */}
        <input
          type="search"
          aria-label="Search"
          placeholder="Search for anything..."
          className="h-[50px] w-full rounded-[45px] border-2 border-black bg-transparent pl-7 pr-14 text-[15px] text-black placeholder:text-black/65 focus:border-gold focus:ring-0"
        />
        <MaskIcon
          name="bitcoin-icons--search-filled"
          size={30}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gold"
        />
      </div>
      <ul className="flex flex-wrap items-center gap-8">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-xl font-light tracking-[0.03em] text-black transition-opacity hover:opacity-70">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
