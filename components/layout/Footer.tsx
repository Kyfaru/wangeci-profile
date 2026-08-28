import Link from "next/link";
import { cn } from "@/lib/cn";

export interface FooterProps {
  className?: string;
}

interface FooterLink {
  href: string;
  label: string;
}

interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

/**
 * Link labels/hrefs below are placeholders — real footer copy (and whether
 * some of these pages exist at all, e.g. "Careers", "Press Kit") is flagged
 * as unfinished in the plan, pending real content. Structure and styling
 * are the deliverable here, not the copy.
 */
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Explore",
    links: [
      { href: "/", label: "Home" },
      { href: "/store", label: "Store" },
      { href: "/about", label: "About" },
      { href: "/services", label: "Services" },
      { href: "/blog", label: "Blog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/contact", label: "Contact" },
      { href: "/press", label: "Press kit" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
      { href: "/refunds", label: "Refund policy" },
    ],
  },
];

const SOCIAL_LINKS: FooterLink[] = [
  { href: "#", label: "Instagram" },
  { href: "#", label: "Facebook" },
  { href: "#", label: "X (Twitter)" },
  { href: "#", label: "YouTube" },
];

/**
 * Marketing-site footer. Copy is placeholder pending the real content pass
 * (see plan) — this establishes the column/social/copyright structure.
 */
export function Footer({ className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer className={cn("border-t border-cream/10 bg-navy text-cream", className)}>
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Link href="/" className="font-display text-xl">
              Wangechi Kariuki
            </Link>
            <p className="mt-4 text-sm text-cream/60">
              Author and entrepreneur, home of &ldquo;From Pieces To
              Power&rdquo; — stories and tools for rebuilding from the
              ground up.
            </p>
            <div className="mt-6 flex items-center gap-3">
              {SOCIAL_LINKS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  className="inline-flex size-9 items-center justify-center rounded-full border border-cream/20 text-xs font-semibold text-cream/80 transition-colors hover:border-gold-bright hover:text-gold-bright"
                >
                  {social.label[0]}
                </a>
              ))}
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <div key={column.heading}>
              <h3 className="text-sm font-semibold tracking-[0.15em] text-gold-bright uppercase">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-cream/70 transition-colors hover:text-cream"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-cream/10 pt-8 text-sm text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} Felister Wangechi Kariuki. All rights reserved.</p>
          <p>Built with care in Kenya.</p>
        </div>
      </div>
    </footer>
  );
}
