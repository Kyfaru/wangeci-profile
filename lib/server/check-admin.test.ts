import { beforeEach, describe, expect, it, vi } from "vitest";

import { ACTIONS, type Action } from "@/lib/permissions";

const state = vi.hoisted(() => ({ session: null as unknown, deleted: [] as string[] }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: async () => state.session } } }));
vi.mock("@/lib/auth/kv", () => ({ getKv: () => ({ get: async () => 1, set: async () => {}, del: async () => {} }) })); // "recently seen": no database write
vi.mock("@/lib/prisma", () => ({ prisma: { session: { deleteMany: async ({ where }: { where: { id: string } }) => void state.deleted.push(where.id) }, user: { update: async () => {} } } }));

import { checkAdmin, getSession, requireRole, requireUser } from "./session";

const session = (role: string, opts: { twoFactor?: boolean; ageMs?: number; banned?: boolean; verified?: boolean } = {}) => ({
  session: { id: "s1", createdAt: new Date(Date.now() - (opts.ageMs ?? 60_000)), twoFactorVerifiedAt: opts.verified === false ? null : new Date() },
  user: { id: "u1", role, twoFactorEnabled: opts.twoFactor ?? true, banned: opts.banned ?? false },
});

beforeEach(() => {
  state.session = null;
  state.deleted = [];
});

describe("the admin gate (checkAdmin / requireRole)", () => {
  it("signed-out visitors get nothing", async () => {
    for (const a of ACTIONS) expect(await checkAdmin(a)).toEqual({ ok: false, reason: "signed-out" });
  });

  it("readers can do nothing in the admin", async () => {
    state.session = session("reader");
    for (const a of ACTIONS) expect(await checkAdmin(a)).toEqual({ ok: false, reason: "forbidden" });
  });

  it("support: can read, cannot refund, grant, revoke, ban, manage roles, publish or read the audit log", async () => {
    state.session = session("support");
    const allowed: Action[] = ["admin.access", "sales.read", "customers.read", "customer.progress.view", "traffic.read", "messages.reply", "comments.moderate"];
    for (const a of ACTIONS) expect((await checkAdmin(a)).ok).toBe(allowed.includes(a));
    for (const a of ["order.refund", "access.grant", "access.revoke", "customer.ban", "roles.manage", "content.manage", "audit.read"] as Action[]) {
      expect(await checkAdmin(a)).toEqual({ ok: false, reason: "forbidden" });
    }
  });

  it("editor: only the blog (and getting into the admin area)", async () => {
    state.session = session("editor");
    for (const a of ACTIONS) expect((await checkAdmin(a)).ok).toBe(a === "admin.access" || a === "blog.write");
  });

  it("owner can do everything once two-step is on", async () => {
    state.session = session("owner");
    for (const a of ACTIONS) expect((await checkAdmin(a)).ok).toBe(true);
  });

  it("an admin without two-step is refused everywhere until they set it up", async () => {
    state.session = session("owner", { twoFactor: false });
    for (const a of ACTIONS) expect(await checkAdmin(a)).toEqual({ ok: false, reason: "needs-2fa" });
    await expect(requireRole("sales.read")).rejects.toThrow("REDIRECT:/dashboard/settings?need2fa=1");
  });

  it("an admin session older than 8 hours is ended", async () => {
    state.session = session("owner", { ageMs: 8 * 3600_000 + 1000 });
    expect(await checkAdmin("sales.read")).toEqual({ ok: false, reason: "expired" });
    expect(state.deleted).toEqual(["s1"]);
    await expect(requireRole("sales.read")).rejects.toThrow("REDIRECT:/sign-in?redirect=/admin");
  });

  it("requireRole hides pages from people who may not see them (404, not a login prompt)", async () => {
    state.session = session("support");
    await expect(requireRole("audit.read")).rejects.toThrow("NOT_FOUND");
    await expect(requireRole("sales.read")).resolves.toMatchObject({ role: "support" });
  });

  it("two-step is on but this session has not entered the code yet: nothing opens (this is what a code or Google sign-in produces)", async () => {
    state.session = session("owner", { verified: false });
    for (const a of ACTIONS) expect(await checkAdmin(a)).toEqual({ ok: false, reason: "pending-2fa" });
    await expect(requireRole("sales.read")).rejects.toThrow("REDIRECT:/verify?step=2fa&redirect=/admin");
    await expect(requireUser()).rejects.toThrow("REDIRECT:/verify?step=2fa");
  });

  it("a session without two-step on, and no code needed, is not held back", async () => {
    state.session = session("reader", { twoFactor: false, verified: false });
    expect(await getSession()).not.toBeNull();
  });

  it("a banned account counts as signed out", async () => {
    state.session = session("owner", { banned: true });
    expect(await checkAdmin("sales.read")).toEqual({ ok: false, reason: "signed-out" });
  });
});
