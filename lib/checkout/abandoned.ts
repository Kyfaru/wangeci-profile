import { prisma } from "@/lib/prisma";

/**
 * Checkout creates an unverified account before the buyer pays. If they never pay, that account is
 * clutter (and holds an email and phone number hostage). Removes accounts older than `before` that
 * nobody verified, signed in to, paid for or was given anything on. Orders block the delete on purpose
 * (a FAILED or EXPIRED order is a record), so an account that ever started a payment is kept.
 */
export async function purgeAbandonedGuestAccounts(before: Date): Promise<number> {
  const { count } = await prisma.user.deleteMany({
    where: {
      createdAt: { lt: before },
      role: "reader",
      emailVerified: false,
      phoneNumberVerified: false,
      orders: { none: {} },
      sessions: { none: {} },
      accounts: { none: {} },
      entitlements: { none: {} },
    },
  });
  return count;
}
