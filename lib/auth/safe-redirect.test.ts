import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safe-redirect";

describe("safeRedirect", () => {
  it.each(["/dashboard", "/dashboard/books?x=1", "/store/from-pieces-to-power#top"])("allows %s", (p) => {
    expect(safeRedirect(p)).toBe(p);
  });

  it.each([
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "evil.com",
    "",
    "/ok\nSet-Cookie:x",
    "/\\/evil.com",
  ])("rejects %j", (p) => {
    expect(safeRedirect(p)).toBe("/dashboard/books");
  });

  it("uses the fallback for null", () => {
    expect(safeRedirect(null, "/")).toBe("/");
  });
});
