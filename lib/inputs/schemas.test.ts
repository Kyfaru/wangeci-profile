/**
 * INPUT FUZZ SUITE, part 1 of 3: pure validators and helpers (no database).
 * Part 2 (routes.test.ts) drives every route handler; part 3 (actions.test.ts) drives the admin writers,
 * server actions and lib/community. Bugs found are pinned with `it.fails("BUG ...")` so the suite stays green
 * and the list of known defects is explicit; when a bug is fixed its `it.fails` starts failing: flip it to `it`.
 *
 * INVENTORY OF SERVER INPUTS (route / method / fields / limits)
 * -------------------------------------------------------------------------------------------------------
 * POST /api/checkout            json: editionIds[1..10] str 1..64 | method card|mpesa | coupon trim <=40 |
 *                               mpesaPhone trim <=20 | buyer{firstName,lastName trim 1..60, email trim lower <=120,
 *                               phone trim 7..20} | turnstileToken <=2048. 30/h per ip, 3 STK/10m per phone, pay ladder.
 * POST /api/checkout/quote      json: editionIds[1..10] 1..64 | coupon <=40. 60/10m per ip.
 * GET  /api/cart/quote          query ids=a,b (1..10 of 1..64). 60/m per ip. invalid -> empty quote (200).
 * POST /api/contact             json: name 1..100 | email <=254 | message 10..3000 | source /contact|/services |
 *                               token <=4096 | website(honeypot) <=200. 5/h per ip, 3/day per email.
 * POST /api/community           json (signed in): kind comment{slug 1..200, body 2..1000} |
 *                               feedback{slug, rating int 1..5 opt, message 2..2000}. 5/h per user, 20/h per ip.
 * GET/POST/DELETE /api/bookmarks GET ?editionId | POST {editionId 1..64, chapterIdx int 0..9999,
 *                               position int 0..1e7 (default 0), note trim <=300} 30/m | DELETE ?id.
 * POST /api/reading/progress    text body JSON {editionId, chapterIdx int 0..9999, offset number 0..1e7}. 40/m per user.
 * GET  /api/media/chapter       query editionId 1..64, idx coerce int 0..9999. 60/m per user.
 * POST /api/media/refresh       json {editionId, chapterIdx int 0..9999}. 60/m per user.
 * GET/POST /api/notifications   POST json {ids?: str 1..64 [<=100]} (empty body = mark all).
 * GET  /api/notifications/unread-count, /api/user/owned, /api/user/bootstrap, /api/health: no input.
 * POST /api/session/replace-consent json {identifier trim 3..320, token 16..128}. 10/10m per ip.
 * POST /api/admin/chapter-audio json {editionId, chapterId 1..64, filename 1..255, contentType 1..100,
 *                               sizeBytes int >0}; ext must be .mp3 (audio/mpeg) or .m4a (audio/mp4|x-m4a); <= 400 MB.
 * GET  /api/orders/[id]         path id, header x-order-token. GET /api/orders/[id]/invoice: same.
 * POST /api/webhooks/paystack   raw body + x-paystack-signature (HMAC sha512).
 * POST /api/webhooks/mpesa/[token] path secret + json STK callback.
 * POST /api/webhooks/resend     svix-id/timestamp/signature headers + json.
 * POST /api/webhooks/sanity     sanity-webhook-signature "t=<ms>,v1=<b64url hmac>".
 * POST /api/webhooks/chatwoot   x-chatwoot-signature/timestamp + json.
 * POST /api/webhooks/africastalking/delivery  x-webhook-token | ?token + form id,status.
 * POST /api/qstash/send-otp     upstash-signature + json {channel email|sms, to 3..320, code ^\d{4,8}$}.
 * GET  /api/cron/orders         Authorization: Bearer CRON_SECRET.
 * /api/auth/[...all]            Better Auth (out of scope; only helpers below are tested).
 * Server actions (app/actions): removeFromCart(ids[<=10]), mergeCart(ids[<=10]), updatePreferences({bool,bool}).
 * Admin actions (app/admin/actions.ts, FormData): coupon (code,type,value,minSubtotal,maxRedemptions,endsAt,reason),
 *   couponActive, refund(orderId,reason), manualRefund(+reference 4..80), grant/revoke access, ban, role,
 *   editionActive, moderateComment(status enum), replyToComment(body 1..1000), feedbackStatus, emailAlerts,
 *   createBook(title<=200, slug 3..80 kebab, author<=120, description<=2000, format, price (0,1e6], currency AAA, narrator<=120),
 *   saveChapter(title 1..200, body <=500000), moveChapter, deleteChapter, attachChapterAudio(key prefix, duration 1..21600),
 *   importManuscript(<=10 MB, <=200 chapters). Every reason: trim 10..500 chars.
 * Pure helpers: lib/phone.ts, lib/reading/text.ts, lib/reading/locator.ts, lib/checkout/pricing.ts,
 *   lib/checkout/reasons.ts, lib/auth/safe-redirect.ts, clientIp (lib/rate-limit.ts), lib/trace.ts scrubbing.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

import { safeRedirect } from "@/lib/auth/safe-redirect";
import { checkCoupon, COUPON_INVALID, feeFor, totals, type CouponRule } from "@/lib/checkout/pricing";
import { shortReason } from "@/lib/checkout/reasons";
import { isE164, maskEmail, maskPhone, normalizeKenyanOrE164 } from "@/lib/phone";
import { clientIp } from "@/lib/rate-limit";
import { encodeLocator, parseLocator, resolveStart } from "@/lib/reading/locator";
import { countWords, normaliseBody, splitManuscript, splitParagraphs } from "@/lib/reading/text";
import { AppError, api, logError, safeEqual } from "@/lib/trace";

const long = (n: number, ch = "a") => ch.repeat(n);

// A shared matrix of hostile strings. None of them may ever crash a pure helper.
const HOSTILE = [
  "",
  " ",
  "\t\n ",
  "a",
  long(10_000),
  "😀👩‍👩‍👧‍👦",
  "‮evil‬",
  "é́́",
  "a​b‍",
  "line1\nline2\r\nline3\tx",
  "nul\0byte",
  "<script>alert(1)</script>",
  '"><img src=x onerror=1>',
  `'; DROP TABLE "user";--`,
  "../../etc/passwd",
  "..\\..\\windows\\system32",
  "9".repeat(400),
  "%00%0d%0a",
  "${7*7}{{7*7}}",
];

describe("phone helpers", () => {
  describe("normalizeKenyanOrE164", () => {
    it.each([
      ["0712345678", "+254712345678"],
      ["0112345678", "+254112345678"],
      ["+254712345678", "+254712345678"],
      ["254712345678", "+254712345678"],
      ["+254 712 345 678", "+254712345678"],
      ["(0712)-345-678", "+254712345678"],
      ["+14155552671", "+14155552671"],
      ["+447911123456", "+447911123456"],
    ])("should normalise %j to %j", (input, expected) => {
      expect(normalizeKenyanOrE164(input)).toBe(expected);
    });

    it.each(["", " ", "0", "07", "0712", "abc", "07abc45678", "+", "+254", "712345678", "447911123456", "٠٧١٢٣٤٥٦٧٨", "０７１２３４５６７８", "+2547123456789012345", "07123456789012345", "+254712345678\0"])(
      "should return null for invalid input %j",
      (input) => {
        expect(normalizeKenyanOrE164(input)).toBeNull();
      },
    );

    it("should not throw and should return null or a valid E.164 for every hostile string", () => {
      for (const s of HOSTILE) {
        const out = normalizeKenyanOrE164(s);
        expect(out === null || isE164(out)).toBe(true);
      }
    });

    it("should handle a 10x-max input without catastrophic slowdown", () => {
      const t = Date.now();
      normalizeKenyanOrE164("0".repeat(200_000));
      expect(Date.now() - t).toBeLessThan(500);
    });

    it.fails("BUG(Med) phone.ts:14 accepts '+0712345678' (country code 0 does not exist) as a valid number", () => {
      expect(normalizeKenyanOrE164("+0712345678")).toBeNull();
    });

    it.fails("BUG(Low) phone.ts:14 accepts the common typo '+2540712345678' (trunk 0 kept after +254); it is not a Kenyan number and M-Pesa later refuses it", () => {
      expect(normalizeKenyanOrE164("+2540712345678")).toBeNull();
    });

    it.fails("BUG(Low) phone.ts:14 accepts a 7-digit Kenyan subscriber '07123456' (too short: +2547123456 is 10 digits in total)", () => {
      expect(normalizeKenyanOrE164("07123456")).toBeNull();
    });
  });

  describe("mask helpers", () => {
    it("should mask an email down to its first character and domain", () => {
      expect(maskEmail("jane@example.com")).toBe("j***@example.com");
      expect(maskEmail("a+tag@sub.example.co.ke")).toBe("a***@sub.example.co.ke");
    });

    it("should mask a phone to its first 4 and last 3 characters and pass null through", () => {
      expect(maskPhone("+254712345678")).toBe("+254***678");
      expect(maskPhone(null)).toBeNull();
      expect(maskPhone("")).toBeNull();
    });

    it("should never reveal the middle of a normal E.164 number or email", () => {
      expect(maskPhone("+254712345678")).not.toContain("7123");
      expect(maskEmail("secretname@example.com")).not.toContain("ecret");
    });
  });
});

describe("chapter text helpers", () => {
  it("should normalise CRLF, lone CR, outer whitespace, a real BOM and 3+ blank lines", () => {
    expect(normaliseBody("﻿  a\r\n\r\n\r\n\r\nb \r\rc\r\n")).toBe("a\n\nb \n\nc");
  });

  it("should be idempotent for every hostile string", () => {
    for (const s of HOSTILE) expect(normaliseBody(normaliseBody(s))).toBe(normaliseBody(s));
  });

  it("should keep HTML and SQL payloads byte-for-byte (escaping is the renderer's job)", () => {
    const payload = `<script>alert(1)</script>\n\n'; DROP TABLE "user";--`;
    expect(normaliseBody(payload)).toBe(payload);
    expect(splitParagraphs(payload)).toEqual([`<script>alert(1)</script>`, `'; DROP TABLE "user";--`]);
  });

  it("should count 0 words for empty, whitespace-only and blank-line-only bodies", () => {
    for (const s of ["", " ", "\n\n\n", "\t \r\n"]) expect(countWords(s)).toBe(0);
  });

  it("should count emoji, combining marks and RTL runs as words split only by whitespace", () => {
    expect(countWords("😀 😀\n\n😀")).toBe(3);
    expect(countWords("é́ b")).toBe(2);
    expect(countWords("שלום עולם")).toBe(2);
  });

  it("should treat a NBSP and ideographic space as word separators", () => {
    expect(countWords("a b　c")).toBe(3);
  });

  it("should treat a zero-width space as part of a word, not a separator (reader and count agree)", () => {
    expect(countWords("a​b")).toBe(1);
  });

  it("should split a 1000-heading manuscript into 1000 chapters quickly", () => {
    const text = Array.from({ length: 1000 }, (_, i) => `## Chapter ${i + 1}\nbody ${i}`).join("\n\n");
    const t = Date.now();
    const parts = splitManuscript(text);
    expect(parts).toHaveLength(1000);
    expect(parts[999]).toEqual({ title: "Chapter 1000", body: "body 999" });
    expect(Date.now() - t).toBeLessThan(500);
  });

  it("should return no chapters when there is no heading, only '##' without a space, or only a trailing '## '", () => {
    expect(splitManuscript("just text")).toEqual([]);
    expect(splitManuscript("##NoSpace\nbody")).toEqual([]);
    expect(splitManuscript("intro\n## ")).toEqual([]);
    expect(splitManuscript("")).toEqual([]);
  });

  it("should give an empty title for '## ' in the middle (the importer must refuse it)", () => {
    expect(splitManuscript("## \nbody\n## Two\nx")[0].title).toBe("");
  });

  it("should handle one giant 5 MB chapter without blowing up", () => {
    const body = long(5_000_000, "word ");
    const parts = splitManuscript(`## Big\n${body}`);
    expect(parts).toHaveLength(1);
    expect(parts[0].body.length).toBeGreaterThan(4_000_000);
  });

  it("should keep headings that contain HTML as plain text", () => {
    expect(splitManuscript(`## <img src=x onerror=1>\nx`)[0].title).toBe("<img src=x onerror=1>");
  });

});

describe("locator helpers", () => {
  it("should round-trip a valid locator and floor/clamp the offset", () => {
    expect(parseLocator(encodeLocator(3, 1250.9))).toEqual({ chapterIdx: 3, offset: 1250 });
    expect(encodeLocator(0, -5)).toBe("0:0");
    expect(encodeLocator(0, Number.NaN)).toBe("0:NaN"); // documents the shape; the route schema never lets NaN in
  });

  it.each(["", "3", "3:", ":3", "-1:2", "1:-2", "1.5:2", "1:2.5", "a:b", "12345:1", "1:1234567890", "1:2:3", " 1:2", "1:2\n", "1e3:4", "１:２"])("should reject malformed locator %j", (s) => {
    expect(parseLocator(s)).toBeNull();
  });

  describe("resolveStart", () => {
    const chapters = [
      { idx: 0, wordCount: 100 },
      { idx: 1, wordCount: 50 },
    ];

    it("should fall back to the top for unknown chapters, NaN, negatives and arrays", () => {
      for (const idx of ["9", "-1", "NaN", "abc", "", "1.5", ["1", "0"] as unknown as string]) {
        expect(resolveStart({ idx }, null, chapters)).toEqual({ position: 0, startWord: 0 });
      }
    });

    it("should clamp a negative or non-numeric word to 0 and honour 'end'", () => {
      expect(resolveStart({ idx: "1", w: "-5" }, null, chapters).startWord).toBe(0);
      expect(resolveStart({ idx: "1", w: "abc" }, null, chapters).startWord).toBe(0);
      expect(resolveStart({ idx: "1", w: "end" }, null, chapters).startWord).toBe(49);
    });

    it.fails("BUG(Low) reading/locator.ts:50 an explicit ?w=Infinity or ?w=1e21 gives a startWord far past the chapter's last word (not clamped to wordCount)", () => {
      expect(resolveStart({ idx: "1", w: "Infinity" }, null, chapters).startWord).toBeLessThan(50);
      expect(resolveStart({ idx: "1", w: "1e21" }, null, chapters).startWord).toBeLessThan(50);
    });
  });
});

describe("pricing", () => {
  const rule = (over: Partial<CouponRule> = {}): CouponRule => ({ code: "X", type: "PERCENT", value: 10, minSubtotal: null, maxRedemptions: null, used: 0, startsAt: null, endsAt: null, isActive: true, ...over });
  const now = new Date("2026-06-01T00:00:00Z");

  it("should refuse every bad coupon with the same sentence", () => {
    const bad: (CouponRule | null)[] = [
      null,
      rule({ isActive: false }),
      rule({ startsAt: new Date("2026-07-01") }),
      rule({ endsAt: new Date("2026-05-01") }),
      rule({ maxRedemptions: 1, used: 1 }),
      rule({ minSubtotal: 5000 }),
    ];
    for (const r of bad) expect(checkCoupon(r, 1000, now)).toEqual({ ok: false, reason: COUPON_INVALID });
  });

  it.each([
    ["PERCENT", 1000, 100, 1000],
    ["PERCENT", 1000, 250, 1000],
    ["PERCENT", 1000, -50, 0],
    ["PERCENT", 999, 33.33, 333],
    ["FIXED", 1000, 5000, 1000],
    ["FIXED", 1000, -10, 0],
    ["FIXED", 1000, 0.4, 0],
    ["FIXED", 1000, 0.5, 1],
  ] as const)("should cap %s discount on subtotal %d with value %d at %d", (type, subtotal, value, expected) => {
    const result = checkCoupon(rule({ type, value }), subtotal, now);
    expect(result).toEqual({ ok: true, discount: expected });
  });

  it("should never discount a zero or tiny subtotal below zero", () => {
    expect(checkCoupon(rule({ type: "FIXED", value: 500 }), 0, now)).toEqual({ ok: true, discount: 0 });
  });

  it("should keep totals as non-negative whole-cent amounts and the discount at most the subtotal", () => {
    for (const subtotal of [0, 0.01, 0.1 + 0.2, 1, 999.99, 1e6]) {
      for (const discount of [0, 0.5, 1, 1e9]) {
        for (const feePercent of [0, 0.5, 2.9, 100]) {
          const t = totals({ subtotal, discount, feePercent });
          expect(t.total).toBeGreaterThanOrEqual(0);
          expect(t.discount).toBeLessThanOrEqual(t.subtotal);
          expect(Number.isInteger(Math.round(t.total * 100))).toBe(true);
          expect(Number.isInteger(t.fee)).toBe(true);
        }
      }
    }
  });

  it("should charge no fee for zero, negative, NaN or missing percentages", () => {
    for (const p of [0, -1, Number.NaN, undefined as unknown as number]) expect(feeFor(1000, p)).toBe(0);
  });

  it("should not lose precision on 0.1 + 0.2 style subtotals", () => {
    expect(totals({ subtotal: 0.1 + 0.2, discount: 0, feePercent: 0 }).total).toBe(0.3);
  });
});

describe("shortReason", () => {
  it("should map provider codes to short sentences", () => {
    expect(shortReason("1032: Request cancelled by user")).toBe("You cancelled the request.");
    expect(shortReason("2001: wrong pin")).toBe("The PIN entered was wrong.");
    expect(shortReason("1: The balance is insufficient")).toBe("Insufficient funds in your account.");
    expect(shortReason("1037: DS timeout")).toBe("No response from your phone.");
  });

  it("should answer null, undefined, empty and hostile input with a short generic sentence and never echo it", () => {
    for (const s of [null, undefined, "", ...HOSTILE]) {
      const out = shortReason(s);
      expect(out.split(" ").length).toBeLessThan(10);
      expect(out).not.toMatch(/<|DROP TABLE|passwd/);
    }
  });

  it("should stay fast on a 1 MB input", () => {
    const t = Date.now();
    shortReason("x".repeat(1_000_000));
    expect(Date.now() - t).toBeLessThan(500);
  });

  it.fails("BUG(Low) checkout/reasons.ts:8 unanchored code patterns misread amounts and ids: 'amount 12001' becomes 'The PIN entered was wrong.'", () => {
    expect(shortReason("Declined for amount 12001")).not.toBe("The PIN entered was wrong.");
  });
});

describe("safeRedirect", () => {
  const FALLBACK = "/dashboard/books";
  const attacks = [
    "//evil.com",
    "///evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "\\/evil.com",
    "https://evil.com",
    "HTTP://evil.com",
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "mailto:a@b.c",
    " //evil.com",
    "\t//evil.com",
    "/\t/evil.com",
    "/\n/evil.com",
    "/\r\n//evil.com",
    "/\u0000/evil.com",
    "%2F%2Fevil.com",
    "%2f%2fevil.com",
    "/%2F%2Fevil.com",
    "evil.com",
    "@evil.com",
    "/\\/evil.com",
    "http:evil.com",
    "//%0Aevil.com",
    "",
    "   ",
  ];

  it.each(attacks)("should not let %j leave the site", (attack) => {
    const out = safeRedirect(attack);
    expect(out === FALLBACK || (out.startsWith("/") && !out.startsWith("//") && !out.includes("\\"))).toBe(true);
    expect(new URL(out, "https://site.test").origin).toBe("https://site.test");
  });

  it("should return the fallback for the open-redirect forms that start with '/'-ish tricks", () => {
    for (const a of ["//evil.com", "/\\evil.com", "https://evil.com", "javascript:alert(1)", "/\t/evil.com"]) expect(safeRedirect(a)).toBe(FALLBACK);
  });

  it("should keep ordinary same-site paths, queries and fragments", () => {
    for (const ok of ["/dashboard", "/store/from-pieces-to-power?x=1#top", "/a/b%20c", "/?next=//evil.com"]) expect(safeRedirect(ok)).toBe(ok);
  });

  it("should treat null, undefined and a custom fallback correctly", () => {
    expect(safeRedirect(null)).toBe(FALLBACK);
    expect(safeRedirect(undefined, "/home")).toBe("/home");
    expect(safeRedirect("//evil.com", "/home")).toBe("/home");
  });

  it("should handle a 1 MB path without throwing", () => {
    expect(() => safeRedirect("/" + long(1_000_000))).not.toThrow();
  });
});

describe("clientIp", () => {
  const withHops = (hops: string | undefined, fn: () => void) => {
    const before = process.env.TRUSTED_PROXY_HOPS;
    if (hops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
    else process.env.TRUSTED_PROXY_HOPS = hops;
    try {
      fn();
    } finally {
      if (before === undefined) delete process.env.TRUSTED_PROXY_HOPS;
      else process.env.TRUSTED_PROXY_HOPS = before;
    }
  };
  const h = (xff?: string) => new Headers(xff === undefined ? {} : { "x-forwarded-for": xff });

  it("should take the right-most entry by default so a client-supplied fake on the left is ignored", () => {
    withHops(undefined, () => {
      expect(clientIp(h("1.1.1.1, 2.2.2.2"))).toBe("2.2.2.2");
      expect(clientIp(h("6.6.6.6, 1.1.1.1, 2.2.2.2"))).toBe("2.2.2.2");
    });
  });

  it("should honour TRUSTED_PROXY_HOPS and fall back to 'unknown' when there are fewer hops than expected", () => {
    withHops("2", () => {
      expect(clientIp(h("6.6.6.6, 1.1.1.1, 2.2.2.2"))).toBe("1.1.1.1");
      expect(clientIp(h("2.2.2.2"))).toBe("unknown");
    });
  });

  it("should answer 'unknown' for a missing or empty header and ignore blank entries", () => {
    withHops(undefined, () => {
      expect(clientIp(h())).toBe("unknown");
      expect(clientIp(h(""))).toBe("unknown");
      expect(clientIp(h(" , ,"))).toBe("unknown");
      expect(clientIp(h("1.1.1.1, ,"))).toBe("1.1.1.1");
    });
  });

  it.each(["0", "-1", "abc", "NaN", "1.5", ""])("should never throw or index out of range for TRUSTED_PROXY_HOPS=%j", (hops) => {
    withHops(hops, () => {
      expect(typeof clientIp(h("1.1.1.1, 2.2.2.2"))).toBe("string");
    });
  });

  it("should not let a spoofed 'x-real-ip' or 'forwarded' header change the answer", () => {
    withHops(undefined, () => {
      const headers = new Headers({ "x-forwarded-for": "2.2.2.2", "x-real-ip": "9.9.9.9", forwarded: "for=8.8.8.8" });
      expect(clientIp(headers)).toBe("2.2.2.2");
    });
  });

  it.fails("BUG(Low) rate-limit.ts:92 the chosen entry is not validated as an IP: any string (up to header size) becomes a rate-limit key and an audit/log value", () => {
    withHops(undefined, () => {
      expect(clientIp(h("<script>alert(1)</script>"))).toBe("unknown");
    });
  });
});

describe("trace.ts scrubbing and api()", () => {
  const capture = () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    return {
      lines: () => [...warn.mock.calls, ...error.mock.calls].map((c) => JSON.parse(c[0] as string) as Record<string, unknown>),
      restore: () => {
        warn.mockRestore();
        error.mockRestore();
      },
    };
  };

  it("should hide emails, phone numbers and long tokens in meta and in the message", () => {
    const log = capture();
    logError("t.scrub", new Error("failed for jane@example.com on 0712 345 678"), { to: "+254712345678", key: "sk_live_" + "A".repeat(50), nested: { email: "a.b@c.co.ke" } });
    const [line] = log.lines();
    log.restore();
    const text = JSON.stringify(line);
    expect(text).not.toMatch(/jane@example\.com|0712 345 678|254712345678|AAAAAAAAAA|a\.b@c\.co\.ke/);
    expect(text).toContain("[email]");
    expect(text).toContain("[phone]");
    expect(text).toContain("[token]");
  });

  it("should cut long strings to 200 chars, arrays to 20 items and deep objects to [deep]", () => {
    const log = capture();
    let deep: Record<string, unknown> = { leaf: "x" };
    for (let i = 0; i < 10; i++) deep = { d: deep };
    logError("t.limits", new Error("m"), { big: "z ".repeat(500), arr: Array.from({ length: 100 }, (_, i) => i), deep });
    const [line] = log.lines();
    log.restore();
    expect((line.big as string).length).toBeLessThanOrEqual(203);
    expect(line.arr).toHaveLength(20);
    expect(JSON.stringify(line.deep)).toContain("[deep]");
  });

  it("should survive hostile strings in meta and message without throwing", () => {
    const log = capture();
    for (const s of HOSTILE) expect(() => logError("t.hostile", new Error(s), { s })).not.toThrow();
    log.restore();
  });

  it("should never put a stack trace in the log line", () => {
    const log = capture();
    logError("t.stack", new Error("boom"));
    const [line] = log.lines();
    log.restore();
    expect(JSON.stringify(line)).not.toMatch(/\n\s+at |\.ts:\d+/);
  });

  const req = (headers: Record<string, string> = {}) => new Request("http://x.test/", { headers });

  it.each(["short", "has space in it", "x".repeat(65), "injectéd-id-12345", "id;DROP-TABLE", "../../etc/passwd"])("should replace the unsafe caller request id %j with a fresh uuid", async (id) => {
    const log = capture();
    const res = await api("t.id", async () => new Response(null, { status: 204 }))(req({ "x-request-id": id }), undefined);
    log.restore();
    expect(res.headers.get("x-request-id")).not.toBe(id);
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("should keep a boring caller request id", async () => {
    const res = await api("t.id", async () => new Response(null, { status: 204 }))(req({ "x-request-id": "abc-12345678" }), undefined);
    expect(res.headers.get("x-request-id")).toBe("abc-12345678");
  });

  it("should answer a thrown unexpected error with 500, a generic message and no internals", async () => {
    const log = capture();
    const res = await api("t.leak", async () => {
      throw new Error('PrismaClientKnownRequestError: Invalid `prisma.user.create()` invocation: column "email" violates SELECT * FROM "user"');
    })(req(), undefined);
    log.restore();
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toMatch(/Prisma|SELECT|column|invocation|\.ts:/);
    expect(JSON.parse(text)).toMatchObject({ code: "INTERNAL", error: expect.any(String), requestId: expect.any(String) });
  });

  it("should add a requestId to a returned 4xx JSON body and set Retry-After on a thrown 429", async () => {
    const log = capture();
    const returned = await api("t.r", async () => Response.json({ error: "Nope" }, { status: 400 }))(req(), undefined);
    const limited = await api("t.l", async () => {
      throw new AppError("RATE_LIMITED", "slow", 429, { retryAfter: 42 });
    })(req(), undefined);
    log.restore();
    expect(await returned.json()).toMatchObject({ error: "Nope", requestId: expect.any(String) });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("42");
  });

  it("should compare secrets in constant time and never throw on different lengths or unicode", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
    expect(safeEqual("é", "e")).toBe(false);
    for (const s of HOSTILE) expect(() => safeEqual(s, "secret")).not.toThrow();
  });
});
