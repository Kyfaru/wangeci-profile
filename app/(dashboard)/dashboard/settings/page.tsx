import type { Metadata } from "next";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { SettingsPanels } from "@/components/settings/SettingsPanels";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const [row, prefs] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phoneNumber: true, twoFactorEnabled: true } }),
    prisma.userPreferences.findUnique({ where: { userId: user.id } }),
  ]);

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        <h1 className="text-3xl font-medium text-black md:text-4xl">Settings</h1>
        <SettingsPanels
          name={row.name}
          email={row.email}
          phone={row.phoneNumber}
          twoFactorEnabled={row.twoFactorEnabled}
          emailNotifications={prefs?.emailNotifications ?? true}
          smsNotifications={prefs?.smsNotifications ?? true}
        />
      </div>
    </>
  );
}
