import { describe, expect, it } from "vitest";

import { isRelaxed } from "@/lib/site";

describe("isRelaxed (safety defaults fail closed)", () => {
  it("is strict in production when NEXT_PUBLIC_SITE_ENV is unset", () => {
    expect(isRelaxed("production", undefined)).toBe(false);
  });
  it("is strict in production when NEXT_PUBLIC_SITE_ENV is production or an unknown value", () => {
    expect(isRelaxed("production", "production")).toBe(false);
    expect(isRelaxed("production", "stagging")).toBe(false);
  });
  it("is relaxed in production only when staging is declared explicitly", () => {
    expect(isRelaxed("production", "staging")).toBe(true);
  });
  it("is relaxed in development and test", () => {
    expect(isRelaxed("development", undefined)).toBe(true);
    expect(isRelaxed("test", undefined)).toBe(true);
  });
});
