import type { Metadata } from "next";

import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { MarkAllRead } from "@/components/dashboard/MarkAllRead";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await prisma.notificationLog.findMany({
    where: { userId: user.id, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        <div className="flex max-w-[760px] items-center justify-between gap-4">
          <h1 className="text-3xl font-medium text-black md:text-4xl">Notifications</h1>
          {unread > 0 && <MarkAllRead />}
        </div>
        {items.length === 0 ? (
          <p className="mt-6 text-lg text-black/70">You are all caught up.</p>
        ) : (
          <ul className="mt-8 max-w-[760px] divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
            {items.map((n) => {
              const inner = (
                <>
                  <span className="flex items-center gap-2 text-lg font-medium text-black">
                    {!n.readAt && <span className="size-2 rounded-full bg-gold" aria-label="Unread" />}
                    {n.title}
                  </span>
                  {n.body && <span className="mt-1 block text-black/70">{n.body}</span>}
                  <span className="mt-1 block text-xs text-black/40">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</span>
                </>
              );
              return (
                <li key={n.id} className="px-5 py-4">
                  {n.link?.startsWith("/dashboard") ? (
                    <a href={n.link} className="block hover:opacity-80">
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
