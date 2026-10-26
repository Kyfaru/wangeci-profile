import type { Metadata } from "next";

import { emailAlertsAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

/** Owner and support: the one admin notification switch (urgent items by email). */
export default async function AdminSettingsPage() {
  const admin = await requireRole("messages.reply");
  const prefs = await prisma.userPreferences.findUnique({ where: { userId: admin.id }, select: { emailNotifications: true } });
  const enabled = prefs?.emailNotifications ?? true;

  return (
    <div className="max-w-[860px] space-y-6">
      <h1 className="text-3xl font-medium text-black md:text-4xl">Settings</h1>
      <section className="rounded-2xl border border-black/10 bg-white p-5" aria-labelledby="alerts">
        <h2 id="alerts" className="font-display text-xl text-black">Email alerts</h2>
        <p className="mt-1 text-sm text-black/60">Email me urgent items (new orders, support messages, comments). Currently {enabled ? "on" : "off"}.</p>
        <div className="mt-3">
          <ActionForm action={emailAlertsAction} hidden={{ enabled: String(!enabled) }} submitLabel={enabled ? "Turn off" : "Turn on"} withReason={false} />
        </div>
      </section>
    </div>
  );
}
