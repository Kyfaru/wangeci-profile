import { notifyAdmins } from "@/lib/server/notify-admins";

export interface SupportMessage {
  id: string;
  name: string;
  email: string;
  message: string;
  /** Where the form lives, e.g. "/contact" or "/services". */
  source: string;
}

/**
 * SupportBridge: the one seam between the contact form and whatever handles support. Today it is
 * the admin bell plus an email to Wangeci (replies happen from her mailbox). A help desk such as
 * Chatwoot can be added later by writing another implementation and changing `supportBridge`
 * below, without touching the form or its API route.
 */
export interface SupportBridge {
  submit(message: SupportMessage): Promise<void>;
}

export const inboxBridge: SupportBridge = {
  async submit(m) {
    await notifyAdmins({
      type: "contact_message",
      title: `New message from ${m.name}`,
      body: `${m.name} <${m.email}>\nvia ${m.source}\n\n${m.message}`,
      link: "/admin/inbox",
      dedupeKey: `contact:${m.id}`,
      urgent: true,
    });
  },
};

export const supportBridge: SupportBridge = inboxBridge;
