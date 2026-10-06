import type { Metadata } from "next";

import { MarkAllRead } from "@/components/dashboard/MarkAllRead";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/server/session";

export const metadata: Metadata = { title: "Inbox" };
export const dynamic = "force-dynamic";

/** The admin's own bell items: contact messages, paid orders, refund and payment alerts. Messages are removed after 90 days. */
export default async function InboxPage() {
  const admin = await requireRole("messages.reply");
  const items = await prisma.notificationLog.findMany({
    where: { userId: admin.id, channel: "IN_APP" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, purpose: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });
  const unread = items.filter((i) => !i.readAt).length;

  return (
    <div className="max-w-[860px]">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-medium text-black md:text-4xl">Inbox</h1>
        {unread > 0 && <MarkAllRead />}
      </div>
      {items.length === 0 ? (
        <p className="mt-6 text-lg text-black/70">Nothing here yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-black/10 rounded-2xl border border-black/10 bg-white">
          {items.map((n) => (
            <li key={n.id} className="px-5 py-4">
              <p className="flex items-center gap-2 font-medium text-black">
                {!n.readAt && <span className="size-2 rounded-full bg-gold" aria-label="Unread" />}
                {n.title}
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-normal text-black/60">{n.purpose.replace(/_/g, " ")}</span>
              </p>
              {/* Plain text only: messages come from the public, so they are never rendered as HTML. */}
              {n.body && <p className="mt-1 whitespace-pre-wrap text-sm text-black/70">{n.body}</p>}
              <p className="mt-1 text-xs text-black/40">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC</p>
              {n.link?.startsWith("/admin") && <a href={n.link} className="mt-1 inline-block text-sm underline">Open</a>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
