"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { broadcastSignOut, useSessionStore } from "@/lib/stores/session-store";

/** Every item is a real page. */
const NAV_LINKS = [
  { label: "Dashboard", icon: "boxicons--dashboard-filled", href: "/dashboard" },
  { label: "My Books", icon: "meteor-icons--books", href: "/dashboard/books" },
  { label: "My Bookmarks", icon: "basil--bookmark-outline", href: "/dashboard/bookmarks" },
  { label: "My Activity", icon: "codicon--graph", href: "/dashboard/activity" },
] as const;

const NAV_LINKS_BOTTOM = [
  { label: "Notifications", icon: "basil--notification-outline", href: "/dashboard/notifications" },
  { label: "Settings", icon: "bytesize--settings", href: "/dashboard/settings" },
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
  const router = useRouter();
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href));

  const [firstName = "?", ...rest] = user.name.trim().split(/\s+/);
  const lastInitial = rest.at(-1)?.[0];
  const initials = `${firstName[0]}${lastInitial ?? ""}`.toUpperCase();

  return (
    <aside className="sticky top-0 flex h-dvh w-[347px] max-w-full shrink-0 flex-col rounded-r-[20px] bg-brand-gradient pt-10 text-white">
      <nav className="flex flex-col gap-1">
        {NAV_LINKS.map((l) => (
          <NavRow key={l.label} {...l} active={isActive(l.href)} />
        ))}
      </nav>

      <div className="flex-1" />

      <nav className="flex flex-col gap-1 pb-8">
        {NAV_LINKS_BOTTOM.map((l) => (
          <NavRow key={l.label} {...l} active={isActive(l.href)} />
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
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut();
              useSessionStore.getState().clear();
              broadcastSignOut();
              router.replace("/sign-in");
              router.refresh();
            }}
            className="text-[11px] text-white/60 underline underline-offset-2 transition-colors hover:text-gold"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
