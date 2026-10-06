import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

export interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164, already validated. */
  phone: string;
}

export class BuyerError extends Error {
  constructor(readonly code: "PHONE_TAKEN", message: string, readonly status = 409) {
    super(message);
    this.name = "BuyerError";
  }
}

export type Buyer = { userId: string; email: string; phone: string | null; accountCreated: boolean };

/**
 * Finds or creates the account a guest purchase belongs to.
 *  - email already has an account: the purchase attaches to it. Nothing about the account changes and the
 *    buyer is NOT signed in (typing someone's email must never open their account); they sign in with a code.
 *  - new email: a new account is created (unverified; the first code sign-in verifies it). The paying device
 *    can claim one session later, see claimSession.
 *  - the phone belongs to a DIFFERENT account: refused with a clear message instead of guessing.
 * Concurrent first-time checkouts for one email are safe: the unique index decides, the loser re-reads.
 */
export async function resolveBuyer(details: GuestDetails): Promise<Buyer> {
  const email = details.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, phoneNumber: true } });
  if (existing) return { userId: existing.id, email, phone: existing.phoneNumber, accountCreated: false };

  const phoneOwner = await prisma.user.findUnique({ where: { phoneNumber: details.phone }, select: { id: true } });
  if (phoneOwner) throw new BuyerError("PHONE_TAKEN", "That phone number is already used by another account. Sign in with it, or use a different number.");

  try {
    const user = await prisma.user.create({
      data: { name: `${details.firstName.trim()} ${details.lastName.trim()}`.trim(), email, phoneNumber: details.phone, emailVerified: false, phoneNumberVerified: false },
      select: { id: true },
    });
    return { userId: user.id, email, phone: details.phone, accountCreated: true };
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      const again = await prisma.user.findUnique({ where: { email }, select: { id: true, phoneNumber: true } });
      if (again) return { userId: again.id, email, phone: again.phoneNumber, accountCreated: false };
      throw new BuyerError("PHONE_TAKEN", "That phone number is already used by another account. Sign in with it, or use a different number.");
    }
    throw error;
  }
}

/** A secret for the paying device: the browser keeps the token, the order keeps only its hash. */
export function newClaimToken() {
  const token = randomBytes(24).toString("base64url");
  return { token, hash: hashToken(token) };
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
