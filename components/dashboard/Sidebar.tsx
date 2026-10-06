"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { cn } from "@/lib/cn";

/** Only "My Books" has a page today — the rest render inert (Figma: 4 designed frames, only this one built). */
const NAV_LINKS = [
  { label: "Dashboard", icon: "boxicons--dashboard-filled", href: "/dashboard" },
  { label: "My Books", icon: "meteor-icons--books", href: "/dashboard/books" },
  { label: "My Bookmarks", icon: "basil--bookmark-outline" },
  { label: "My Activity", icon: "codicon--graph" },
] as const;

const NAV_LINKS_BOTTOM = [
  { label: "Notifications", icon: "basil--notification-outline" },
  { label: "Settings", icon: "bytesize--settings" },
] as const;

function NavRow({
  label,
  icon,
  href,
  active,
}: {
  label: string;
  icon: string;
  href?: string;
  active: boolean;
}) {
  const rowClass = cn(
    "flex items-center gap-4 rounded-[5px] px-8 py-4 font-display text-xl transition-colors",
    active ? "bg-white/10 text-gold" : href ? "text-white hover:bg-white/5" : "text-white/40",
  );

  if (!href) {
    return (
      <div className={cn(rowClass, "cursor-default")} title="Coming soon">
        <MaskIcon name={icon} size={22} />
        {label}
      </div>
    );
  }

  return (
    <Link href={href} className={rowClass}>
      <MaskIcon name={icon} size={22} />
      {label}
    </Link>
  );
}

/** Navy → blue gradient sidebar (Figma: "My dashboard" / "The Book" frames, both node ids under fileKey ZhDSoJk2pmyzQ2AsOYAM1m). */
export function Sidebar({ user }: { user: { name: string } }) {
  const pathname = usePathname();
  const booksActive = pathname.startsWith("/dashboard/books");

  const [firstName = "?", ...rest] = user.name.trim().split(/\s+/);
  const lastInitial = rest.at(-1)?.[0];
  const initials = `${firstName[0]}${lastInitial ?? ""}`.toUpperCase();

  return (
    <aside className="sticky top-0 flex h-screen w-[347px] shrink-0 flex-col rounded-r-[20px] bg-[linear-gradient(170deg,var(--navy)_3%,var(--blue)_143%)] pt-10 text-white">
      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map((l) => (
          <NavRow key={l.label} {...l} active={"href" in l && l.href === "/dashboard/books" && booksActive} />
        ))}
      </nav>

      <div className="flex-1" />

      <nav className="flex flex-col gap-1 pb-8">
        {NAV_LINKS_BOTTOM.map((l) => (
          <NavRow key={l.label} {...l} active={false} />
        ))}
      </nav>

      <div className="mx-8 flex items-center gap-3 border-t border-white/10 pt-6 pb-8">
        <div className="grid size-[52px] shrink-0 place-items-center rounded-full bg-white/10 font-display text-lg">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-[15px]">
            {firstName} {lastInitial ? `${lastInitial}.` : ""}
          </p>
          <p className="truncate text-[11px] text-white/60">@{firstName.toLowerCase()}</p>
        </div>
      </div>
    </aside>
  );
}
