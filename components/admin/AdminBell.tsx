import { NotificationBell } from "@/components/dashboard/NotificationBell";

/** The admin bell: the shared bell pointed at /admin/inbox. */
export const AdminBell = () => <NotificationBell href="/admin/inbox" label="Inbox" compact />;
