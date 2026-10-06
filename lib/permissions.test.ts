import { describe, expect, it } from "vitest";
import { ACTIONS, can } from "./permissions";

describe("can()", () => {
  it("owner can do everything", () => {
    for (const a of ACTIONS) expect(can("owner", a)).toBe(true);
  });

  it("support reads and moderates but cannot refund, grant, ban or manage roles", () => {
    expect(can("support", "sales.read")).toBe(true);
    expect(can("support", "comments.moderate")).toBe(true);
    for (const a of ["order.refund", "access.grant", "access.revoke", "customer.ban", "roles.manage", "audit.read", "content.manage", "coupon.manage"] as const) {
      expect(can("support", a)).toBe(false);
    }
  });

  it("editor only reaches the blog", () => {
    expect(can("editor", "blog.write")).toBe(true);
    expect(can("editor", "sales.read")).toBe(false);
    expect(can("editor", "comments.moderate")).toBe(false);
  });

  it("readers and unknown roles get nothing", () => {
    for (const a of ACTIONS) {
      expect(can("reader", a)).toBe(false);
      expect(can(null, a)).toBe(false);
      expect(can("admin", a)).toBe(false);
      expect(can(undefined, a)).toBe(false);
    }
  });
});
