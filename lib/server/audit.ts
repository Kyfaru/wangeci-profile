import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AuditEntry {
  adminId: string;
  /** Dotted action name, e.g. "refund.requested", "refund.completed", "access.granted". */
  action: string;
  targetType: string;
  targetId: string;
  meta?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Writes one audit_log row. Pass a transaction client to write it in the SAME transaction as the change
 * it describes (so the change and its record succeed or fail together).
 */
export async function recordAudit(entry: AuditEntry, db: Prisma.TransactionClient | typeof prisma = prisma): Promise<void> {
  await db.auditLog.create({
    data: { adminId: entry.adminId, action: entry.action, targetType: entry.targetType, targetId: entry.targetId, meta: entry.meta, ip: entry.ip ?? null },
  });
}

/** The account that owns the business: used as the actor when a refund was started outside our admin. */
export async function findOwnerId(db: Prisma.TransactionClient | typeof prisma = prisma): Promise<string | null> {
  const owner = await db.user.findFirst({ where: { role: "owner" }, select: { id: true }, orderBy: { createdAt: "asc" } });
  return owner?.id ?? null;
}
