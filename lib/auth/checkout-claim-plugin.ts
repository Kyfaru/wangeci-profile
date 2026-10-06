import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";

import { hashToken } from "@/lib/checkout/guest";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/server/activity";

const CLAIM_WINDOW_MS = 24 * 3_600_000;

/**
 * POST /api/auth/checkout/claim: signs the device that just paid into the account that payment CREATED.
 * Only an account made by that very order qualifies, and only once, and only for the holder of the secret
 * the browser was given at checkout (the order stores just its hash). An existing account is never signed in
 * this way, because typing someone's email at checkout must not open their account.
 * The one-session rule and the device cookie still apply: the session is created through Better Auth itself.
 */
export const checkoutClaim = () =>
  ({
    id: "checkout-claim",
    endpoints: {
      claimCheckoutSession: createAuthEndpoint(
        "/checkout/claim",
        { method: "POST", body: z.object({ orderId: z.string().min(1).max(64), token: z.string().min(16).max(128) }) },
        async (ctx) => {
          const deny = () => new APIError("FORBIDDEN", { code: "CLAIM_REFUSED", message: "This sign-in link is no longer valid. Please sign in with a code." });
          const ip = ctx.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
          if (!(await rateLimit(`claim:${ip}`, 10, "10 m")).ok) throw new APIError("TOO_MANY_REQUESTS", { code: "CLAIM_RATE_LIMIT", message: "Too many attempts." });

          const order = await prisma.order.findUnique({ where: { id: ctx.body.orderId }, select: { id: true, userId: true, status: true, paidAt: true, accountCreated: true, claimTokenHash: true, claimedAt: true } });
          if (!order || order.status !== "PAID" || !order.accountCreated || order.claimedAt || !order.claimTokenHash) throw deny();
          if (!order.paidAt || Date.now() - order.paidAt.getTime() > CLAIM_WINDOW_MS) throw deny();
          if (hashToken(ctx.body.token) !== order.claimTokenHash) throw deny(); // hashes of random secrets: no timing risk worth guarding

          // One winner: the conditional update only succeeds while the order is still unclaimed.
          const { count } = await prisma.order.updateMany({ where: { id: order.id, claimedAt: null }, data: { claimedAt: new Date() } });
          if (count === 0) throw deny();

          const user = await ctx.context.internalAdapter.findUserById(order.userId);
          if (!user) throw deny(); // a banned user is hidden by getSession anyway
          let session;
          try {
            session = await ctx.context.internalAdapter.createSession(user.id);
          } catch (error) {
            await prisma.order.updateMany({ where: { id: order.id }, data: { claimedAt: null } }); // nothing was issued, so the claim is not used up
            throw error;
          }
          await setSessionCookie(ctx, { session, user });
          await logActivity({ userId: user.id, type: "checkout.account_claimed", metadata: { orderId: order.id } });
          return ctx.json({ ok: true });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
