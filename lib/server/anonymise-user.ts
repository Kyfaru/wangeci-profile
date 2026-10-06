import { prisma } from "@/lib/prisma";

/**
 * Privacy request: blank the person's name, email and phone and end their sessions, but KEEP their
 * orders and entitlements (those are financial records, and their foreign keys are RESTRICT).
 * The row stays; nothing in it identifies the person any more.
 */
export async function anonymiseUser(userId: string): Promise<void> {
  const tag = `deleted-${userId}`;
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.account.deleteMany({ where: { userId } }),
    prisma.twoFactor.deleteMany({ where: { userId } }),
    prisma.userDevice.deleteMany({ where: { userId } }),
    prisma.activityEvent.deleteMany({ where: { userId } }),
    prisma.bookmark.deleteMany({ where: { userId } }),
    prisma.cart.deleteMany({ where: { userId } }),
    prisma.notificationLog.updateMany({ where: { userId }, data: { recipient: "anonymised", title: null, body: null, link: null } }),
    prisma.user.update({
      where: { id: userId },
      data: {
        name: "Deleted reader",
        email: `${tag}@anonymised.invalid`,
        emailVerified: false,
        image: null,
        phoneNumber: null,
        phoneNumberVerified: false,
        twoFactorEnabled: false,
        banned: false,
        banReason: null,
        banExpires: null,
      },
    }),
  ]);
}
