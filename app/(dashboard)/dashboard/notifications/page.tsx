import type { ComponentType } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { MessageIcon } from "@/components/dashboard/icons";
import { Card, SectionHeading } from "@/components/ui";
import { ActivityIcon, BellIcon, BookIcon, CartIcon } from "@/components/layout/icons";
import { cn } from "@/lib/cn";
import { getNotificationsForUser, type NotificationType } from "@/lib/mock-notifications";
import { CURRENT_USER_ID } from "@/lib/dashboard/current-user";

export const metadata: Metadata = {
  title: "Notifications — Felister Wangechi Kariuki",
};

const NOTIFICATION_ICONS: Record<NotificationType, ComponentType<{ className?: string }>> = {
  "new-chapter": BookIcon,
  "order-update": CartIcon,
  reply: MessageIcon,
  milestone: ActivityIcon,
  announcement: BellIcon,
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * `/dashboard/notifications` — reads `lib/mock-notifications.ts` directly
 * (same server-side convention as the rest of `/dashboard`; see
 * `lib/dashboard/current-user.ts`). Purely a read/display view here — no
 * "mark as read" mutation is wired up, since no such Route Handler exists
 * in `app/api/notifications/**` yet (only `GET /` and
 * `GET /unread-count`), and that surface is explicitly out of scope to add.
 */
export default function DashboardNotificationsPage() {
  const notifications = getNotificationsForUser(CURRENT_USER_ID);

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6">
      <SectionHeading as="h1" eyebrow="Stay in the loop">
        Notifications
      </SectionHeading>

      {notifications.length === 0 ? (
        <EmptyState message="You're all caught up — no notifications yet." />
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type];
            const content = (
              <div className="flex items-start gap-3.5">
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full",
                    notification.read
                      ? "bg-navy/5 text-navy"
                      : "bg-gold-bright/25 text-gold",
                  )}
                >
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3
                      className={cn(
                        "text-sm text-navy",
                        !notification.read && "font-semibold",
                      )}
                    >
                      {notification.title}
                    </h3>
                    <span className="shrink-0 text-xs text-gray">
                      {formatDateTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray">
                    {notification.message}
                  </p>
                </div>
                {!notification.read && (
                  <span
                    aria-label="Unread"
                    className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-bright"
                  />
                )}
              </div>
            );

            return (
              <Card
                key={notification.id}
                padding="md"
                as="article"
                className={cn(
                  !notification.read && "border-gold-bright/40 bg-gold-bright/5",
                )}
              >
                {notification.link ? (
                  <Link href={notification.link}>{content}</Link>
                ) : (
                  content
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
