import { prisma } from "@/lib/prisma";

/**
 * Writes one row to the first-party activity log. Fire-and-forget: a logging failure must never
 * break the request that caused it, so errors are swallowed and printed.
 */
export async function logActivity(params: {
  userId: string;
  type: string;
  metadata?: Record<string, string | number | boolean | null>;
  visitorId?: string | null;
}): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: { userId: params.userId, type: params.type, metadata: params.metadata, visitorId: params.visitorId ?? null },
    });
  } catch (error) {
    console.error("[activity] failed to log", params.type, error);
  }
}
