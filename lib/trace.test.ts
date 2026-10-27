import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { NextResponse } from "next/server";
import { AppError, api, logError, safeEqual } from "./trace";

const req = (id?: string) => new Request("http://x.test/", { headers: id ? { "x-request-id": id } : {} });

describe("api() wrapper", () => {
  it("answers an AppError with its status, code and a request id, and logs one line", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await api("t.a", async () => {
      throw new AppError("ORDER_NOT_FOUND", "No such order", 404);
    })(req("req-12345678"), undefined);
    expect(res.status).toBe(404);
    expect(res.headers.get("x-request-id")).toBe("req-12345678");
    expect(await res.json()).toEqual({ error: "No such order", code: "ORDER_NOT_FOUND", requestId: "req-12345678" });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.parse(warn.mock.calls[0][0] as string)).toMatchObject({ name: "t.a", code: "ORDER_NOT_FOUND", requestId: "req-12345678" });
    warn.mockRestore();
  });

  it("hides the message and stack of an unexpected error and still gives a request id", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await api("t.b", async () => {
      throw new Error("connect ECONNREFUSED 10.0.0.5:5432 user=admin");
    })(req(), undefined);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe("INTERNAL");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(typeof body.requestId).toBe("string");
    err.mockRestore();
  });

  it("adds the request id to a RETURNED error body and logs it", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await api("t.c", async () => NextResponse.json({ error: "Bad", code: "BAD_INPUT" }, { status: 400 }))(req("req-aaaaaaaa"), undefined);
    expect(await res.json()).toMatchObject({ code: "BAD_INPUT", requestId: "req-aaaaaaaa" });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("ignores a malformed incoming request id", async () => {
    const res = await api("t.d", async () => NextResponse.json({ ok: true }))(req("bad id with spaces!"), undefined);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("a logError inside the handler carries the request id without passing it", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await api("t.e", async () => {
      logError("t.e.step", new Error("boom"));
      return NextResponse.json({ ok: true });
    })(req("req-bbbbbbbb"), undefined);
    expect(JSON.parse(err.mock.calls[0][0] as string).requestId).toBe("req-bbbbbbbb");
    err.mockRestore();
  });
});

describe("log scrubbing and safeEqual", () => {
  it("hides emails and phone numbers in messages", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    logError("t.f", new Error("failed for jane@example.com on +254712345678"));
    const line = err.mock.calls[0][0] as string;
    expect(line).not.toContain("jane@example.com");
    expect(line).not.toContain("254712345678");
    err.mockRestore();
  });

  it("compares secrets in constant time and rejects different lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("abc", "abd")).toBe(false);
  });
});
