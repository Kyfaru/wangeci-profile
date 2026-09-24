import type { Metadata } from "next";
import { SettingsForm } from "@/components/dashboard/SettingsForm";
import { SectionHeading } from "@/components/ui";
import { findUserById, toPublicUser } from "@/lib/mock-user";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";

export const metadata: Metadata = {
  title: "Settings — Felister Wangechi Kariuki",
};

/**
 * `/dashboard/settings` — plausible settings UI, no real persistence (see
 * `SettingsForm`'s doc comment). No password field: this app is
 * passwordless (plan §2A).
 */
export default function DashboardSettingsPage() {
  const record = findUserById(CURRENT_USER_ID);
  const user = record ? toPublicUser(record) : undefined;

  return (
    <div className="mx-auto flex w-full max-w-[700px] flex-col gap-6">
      <SectionHeading as="h1" eyebrow="Your account">
        Settings
      </SectionHeading>

      <SettingsForm
        name={user?.name ?? "Guest"}
        email={user?.email ?? ""}
        avatar={user?.avatar}
      />
    </div>
  );
}
