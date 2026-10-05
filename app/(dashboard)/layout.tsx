import { Sidebar } from "@/components/dashboard/Sidebar";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";
import { findUserById, toPublicUser } from "@/lib/mock-user";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  const record = findUserById(CURRENT_USER_ID);
  if (!record) {
    // Seed data guarantees this id exists — fail loudly if the fixture ever changes.
    throw new Error(`Demo user ${CURRENT_USER_ID} not found in MOCK_USERS`);
  }

  return (
    <div className="flex min-h-screen bg-cream">
      <Sidebar user={toPublicUser(record)} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
