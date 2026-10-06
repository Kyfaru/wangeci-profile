import { createElement } from "react";

import AdminAlertEmail from "@/emails/admin-alert-email";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export interface AdminNotice {
  /** Short machine label, e.g. "contact_message", "order_paid". */
  type: string;
  title: string;
  body: string;
  /** Where the bell item should lead (a path inside /admin). */
  link?: string;
  /** One row per (admin, dedupeKey): repeated webhooks or retries never create duplicates. */
  dedupeKey: string;
  /** Also email the owner immediately. */
  urgent?: boolean;
}

/** Admin roles that should see a given kind of notice. Permissions come from lib/permissions.ts. */
const ADMIN_ROLES = ["owner", "support"] as const;

/**
 * Puts one in-app (bell) item in front of every admin who is allowed to see it, and optionally
 * emails the owner inbox. Safe to call twice with the same dedupeKey.
 */
export async function notifyAdmins(notice: AdminNotice): Promise<void> {
  const admins = await prisma.user.findMany({
    where: { role: { in: [...ADMIN_ROLES] }, banned: false },
    select: { id: true, role: true },
  });
  const recipients = admins.filter((a) => can(a.role, "messages.reply"));

  if (recipients.length > 0) {
    await prisma.notificationLog.createMany({
      data: recipients.map((a) => ({
        userId: a.id,
        channel: "IN_APP" as const,
        status: "DELIVERED" as const,
        purpose: notice.type,
        recipient: "in-app",
        title: notice.title,
        body: notice.body,
        link: notice.link ?? null,
        dedupeKey: notice.dedupeKey,
      })),
      skipDuplicates: true, // the unique (userId, dedupeKey) makes repeats a no-op
    });
  }

  if (notice.urgent && env.CONTACT_INBOX_EMAIL) {
    await sendEmail({
      to: env.CONTACT_INBOX_EMAIL,
      subject: notice.title,
      react: createElement(AdminAlertEmail, { title: notice.title, body: notice.body }),
      purpose: notice.type,
    }).catch((error) => console.error("[notifyAdmins] email failed", error));
  }
}
