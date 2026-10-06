"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { MaskIcon } from "@/components/ui/MaskIcon";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { broadcastSignOut, useSessionStore } from "@/lib/stores/session-store";

export interface AdminLink {
  label: string;
  href: string;
  icon: string;
}

/** Same look as the reader sidebar (one shared brand gradient), with the admin link list. The server only passes links this role may open. */
export function AdminSidebar({ user, links }: { user: { name: string; role: string }; links: AdminLink[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));

  return (
    <aside className="sticky top-0 flex h-dvh w-[300px] max-w-full shrink-0 flex-col rounded-r-[20px] bg-brand-gradient pt-8 text-white">
      <p className="px-8 font-display text-2xl text-gold">Admin</p>
      <nav className="mt-6 flex flex-col gap-1" aria-label="Admin">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn("flex items-center gap-4 rounded-[5px] px-8 py-3.5 font-display text-lg transition-colors", isActive(l.href) ? "bg-white/10 text-gold" : "text-white hover:bg-white/5")}
          >
            <MaskIcon name={l.icon} size={20} />
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex-1" />
      <Link href="/dashboard/books" className="px-8 pb-4 text-sm text-white/70 hover:text-gold">
        ← Reader view
      </Link>
      <div className="mx-8 flex items-center gap-3 border-t border-white/10 pb-8 pt-5">
        <div className="min-w-0">
          <p className="truncate font-display text-[15px]">{user.name}</p>
          <p className="text-[11px] uppercase tracking-wide text-white/60">{user.role}</p>
          <button
            type="button"
            onClick={async () => {
              await authClient.signOut();
              useSessionStore.getState().clear();
              broadcastSignOut();
              router.replace("/sign-in");
              router.refresh();
            }}
            className="mt-1 text-[11px] text-white/60 underline underline-offset-2 hover:text-gold"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
