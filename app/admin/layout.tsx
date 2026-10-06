import type { Metadata } from "next";

import { AdminSidebar, type AdminLink } from "@/components/admin/AdminSidebar";
import { AdminBell } from "@/components/admin/AdminBell";
import { MobileNav } from "@/components/dashboard/MobileNav";
import { can, type Action } from "@/lib/permissions";
import { requireRole } from "@/lib/server/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin" }, robots: { index: false, follow: false } };

const LINKS: (AdminLink & { needs: Action })[] = [
  { label: "Overview", href: "/admin", icon: "boxicons--dashboard-filled", needs: "sales.read" },
  { label: "Sales", href: "/admin/sales", icon: "codicon--graph", needs: "sales.read" },
  { label: "Customers", href: "/admin/customers", icon: "basil--bookmark-outline", needs: "customers.read" },
  { label: "Inbox", href: "/admin/inbox", icon: "basil--notification-outline", needs: "messages.reply" },
  { label: "Content", href: "/admin/content", icon: "meteor-icons--books", needs: "content.manage" },
  { label: "Roles", href: "/admin/roles", icon: "bytesize--settings", needs: "roles.manage" },
  { label: "Audit log", href: "/admin/audit", icon: "codicon--graph", needs: "audit.read" },
];

/**
 * Every admin page sits behind this gate: a real session, a role allowed into the admin, two-step set up,
 * and a session under 8 hours old. Each page and server action then re-checks its own permission.
 */
export default async function AdminLayout({ children }: LayoutProps<"/">) {
  const user = await requireRole("admin.access");
  const links: AdminLink[] = LINKS.filter((l) => can(user.role, l.needs)).map((l) => ({ label: l.label, href: l.href, icon: l.icon }));
  const me = { name: user.name, role: user.role ?? "reader" };

  return (
    <div className="flex min-h-screen bg-cream">
      <div className="hidden md:block">
        <AdminSidebar user={me} links={links} />
      </div>
      <div className="min-w-0 flex-1">
        <MobileNav title="Wangeci admin">
          <AdminSidebar user={me} links={links} />
        </MobileNav>
        <div className="flex items-center justify-end border-b border-black/10 px-6 py-2 md:px-10">
          <AdminBell />
        </div>
        <div className="px-6 py-8 md:px-10">{children}</div>
      </div>
    </div>
  );
}
