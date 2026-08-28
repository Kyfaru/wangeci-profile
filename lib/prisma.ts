import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Singleton Prisma client.
 *
 * Next.js hot-reloads server modules on every save in dev, which would
 * otherwise construct a brand new PrismaClient (and a brand new Postgres
 * connection pool) on every edit and eventually exhaust the database's
 * connection limit. Stashing the instance on `globalThis` survives the
 * module reload so dev keeps reusing the same client.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
