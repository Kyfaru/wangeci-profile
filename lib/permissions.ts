/**
 * The one place that says who may do what. Roles live in user.role; every admin page, route
 * handler and server action calls requireRole() / can() instead of checking role names itself.
 *
 *   owner   everything
 *   support read sales, customers and traffic; view one customer's progress (logged);
 *           reply to messages; moderate comments
 *   editor  blog content only
 *   reader  nothing in the admin
 */
export const ROLES = ["owner", "support", "editor", "reader"] as const;
export type Role = (typeof ROLES)[number];

export const ACTIONS = [
  "admin.access",
  "sales.read",
  "customers.read",
  "customer.progress.view",
  "traffic.read",
  "messages.reply",
  "comments.moderate",
  "blog.write",
  "order.refund",
  "access.grant",
  "access.revoke",
  "customer.ban",
  "content.manage",
  "coupon.manage",
  "roles.manage",
  "audit.read",
] as const;
export type Action = (typeof ACTIONS)[number];

const SUPPORT: readonly Action[] = [
  "admin.access",
  "sales.read",
  "customers.read",
  "customer.progress.view",
  "traffic.read",
  "messages.reply",
  "comments.moderate",
];

const TABLE: Record<Role, readonly Action[]> = {
  owner: ACTIONS,
  support: SUPPORT,
  editor: ["admin.access", "blog.write"],
  reader: [],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Unknown roles (null, typos, old values) get no permissions: fail closed. */
export function can(role: unknown, action: Action): boolean {
  return isRole(role) && TABLE[role].includes(action);
}
