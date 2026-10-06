import type { Metadata } from "next";

import { roleAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { ASSIGNABLE_ROLES } from "@/lib/admin/actions";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

/** Owner only. The owner role itself comes from the seeded allowlist and cannot be changed here. */
export default async function RolesPage() {
  const me = await requireRole("roles.manage");
  const staff = await prisma.user.findMany({ where: { role: { not: "reader" } }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, twoFactorEnabled: true } });

  return (
    <div className="max-w-[860px] space-y-8">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Roles</h1>

      <section className="rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="staff">
        <h2 id="staff" className="font-display text-xl text-black">Staff</h2>
        <ul className="mt-3 divide-y divide-black/5 text-sm">
          {staff.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <span><span className="font-medium">{s.name || s.email}</span> <span className="text-black/50">{s.email}</span></span>
              <span>{s.role}{!s.twoFactorEnabled && <span className="ml-2 text-xs text-error">two-step not set up</span>}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-black/50">Staff must set up two-step (authenticator app) before they can open any admin page.</p>
      </section>

      <section className="rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="change">
        <h2 id="change" className="font-display text-xl text-black">Change someone&apos;s role</h2>
        <p className="mb-3 mt-1 text-sm text-black/60">The person must already have an account. They are signed out so the new role applies at once. Customer user ids are on their customer page URL.</p>
        <ActionForm action={roleAction} hidden={{}} submitLabel="Change role">
          <label className="block text-sm text-black/70">Customer id
            <input name="userId" required className="mt-1 w-full rounded-xl border-black/20 text-sm" placeholder="paste from /admin/customers/<id>" />
          </label>
          <label className="block text-sm text-black/70">New role
            <select name="role" required className="mt-1 w-full rounded-xl border-black/20 text-sm">{ASSIGNABLE_ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}</select>
          </label>
        </ActionForm>
        <p className="mt-3 text-xs text-black/50">You are signed in as {me.email} (owner).</p>
      </section>
    </div>
  );
}
