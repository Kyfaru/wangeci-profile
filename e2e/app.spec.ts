import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { createUser, db, e2eEmail, e2ePhone, nationalOf, uid } from "./db";

/**
 * End-to-end specs for the money path, sign-in rules, error shape and comment moderation.
 * Everything runs against the local database. Anything that needs a real Paystack, Daraja, Resend or
 * Turnstile secret is skipped with a reason (see the bottom of the file).
 */

const BASE = `http://localhost:${process.env.E2E_PORT ?? 3123}`;
const BOOK_SLUG = "test-media-book";
const EDITION = "test-ebook"; // KES 50

/** Each test gets its own "network address" so the per-IP checkout limits of one test never hit another. */
const fakeIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;

let ip = fakeIp();
// Cloudflare Turnstile always accepts this token with its public TEST secret (what .env.local uses). Where no
// secret is set (CI) the server skips the check and ignores it.
const TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const FAKE_TURNSTILE = `(() => {
  let opts;
  window.turnstile = {
    render(el, o) { opts = o; setTimeout(() => o.callback("${TURNSTILE_TOKEN}"), 0); return "e2e-widget"; },
    reset() { if (opts) setTimeout(() => opts.callback("${TURNSTILE_TOKEN}"), 0); },
    remove() {},
  };
})();`;

test.beforeEach(async ({ context }) => {
  ip = fakeIp();
  await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  // The browser widget is replaced by a stub that hands out the test token at once (no third-party iframe).
  await context.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE }));
});

const apiHeaders = () => ({ "x-forwarded-for": ip, origin: BASE });

/** Puts one book in the browser's cart, the same way the store does (zustand `wangeci-cart`). */
async function seedCart(page: Page, editionId = EDITION, price = 50) {
  await page.addInitScript(
    ([id, p]) => {
      try {
        if (!localStorage.getItem("wangeci-cart")) {
          const item = { id: `book:x:${id}`, itemId: "x", editionId: id, type: "book", title: "Test Media Book", price: p, currency: "KES", qty: 1 };
          localStorage.setItem("wangeci-cart", JSON.stringify({ state: { items: [item] }, version: 0 }));
        }
      } catch {
        /* storage unavailable: the spec fails visibly on the checkout page instead */
      }
    },
    [editionId, price] as const,
  );
}

interface Guest {
  first: string;
  last: string;
  email: string;
  phone: string; // E.164
}
const newGuest = (over: Partial<Guest> = {}): Guest => ({ first: "Ada", last: "Tester", email: e2eEmail(), phone: e2ePhone(), ...over });

async function fillGuest(page: Page, g: Guest) {
  const details = page.locator('section[aria-labelledby="s1"]');
  await details.getByLabel("First name").fill(g.first);
  await details.getByLabel("Last name").fill(g.last);
  await details.getByLabel("Email").fill(g.email);
  await details.getByPlaceholder("712 345 678").fill(nationalOf(g.phone));
}

/** Free guest purchase over the API, then the paying device claims its session (what the browser does). */
async function signInAsNewReader(request: APIRequestContext) {
  const guest = newGuest();
  const res = await request.post("/api/checkout", {
    headers: apiHeaders(),
    data: { editionIds: [EDITION], method: "card", coupon: "FREE100", turnstileToken: TURNSTILE_TOKEN, buyer: { firstName: guest.first, lastName: guest.last, email: guest.email, phone: guest.phone } },
  });
  expect(res.status(), await res.text()).toBe(200);
  const order = (await res.json()) as { orderId: string; claimToken: string };
  const claim = await request.post("/api/auth/checkout/claim", { headers: apiHeaders(), data: { orderId: order.orderId, token: order.claimToken } });
  expect(claim.status(), await claim.text()).toBe(200);
  return guest;
}

test.describe("guest checkout", () => {
  test("should sign the device in and reach the dashboard when a new guest pays with a 100% coupon", async ({ page, context }) => {
    const guest = newGuest();
    await seedCart(page);
    await page.goto("/checkout");
    await fillGuest(page, guest);
    await page.getByLabel("Coupon code").fill("FREE100");
    await page.getByRole("button", { name: "Apply" }).click();
    const pay = page.getByRole("button", { name: "Get my book" });
    await expect(pay).toBeVisible();

    const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/checkout" && r.request().method() === "POST");
    await pay.click();
    const body = await (await response).json();

    expect(body.free).toBe(true);
    await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible();
    await page.waitForURL(/\/checkout\/success\?ref=/);
    await page.getByRole("link", { name: "Go to dashboard" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 100_000 }); // the first signed-in dashboard render compiles on demand
    expect((await context.cookies()).some((c) => c.name.includes("session_token"))).toBe(true);

    const order = await db().order.findUniqueOrThrow({ where: { id: body.orderId }, include: { user: true } });
    expect(order.status).toBe("PAID");
    expect(order.user.email).toBe(guest.email);
    expect(order.accountCreated).toBe(true);
    expect(order.claimedAt).not.toBeNull();
  });

  test("should not sign the device in when the guest uses the email of an existing account", async ({ page }) => {
    const owner = await createUser();
    const guest = newGuest({ email: owner.email });
    await seedCart(page);
    await page.goto("/checkout");
    await fillGuest(page, guest);
    await page.getByLabel("Coupon code").fill("FREE100");
    await page.getByRole("button", { name: "Apply" }).click();

    const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/checkout" && r.request().method() === "POST");
    await page.getByRole("button", { name: "Get my book" }).click();
    const body = (await (await response).json()) as { orderId: string; claimToken: string; free: boolean };
    expect(body.free).toBe(true);
    await page.waitForURL(/\/checkout\/success\?ref=/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);

    // Even holding the paying device's own token, an existing account can never be claimed.
    const claim = await page.request.post("/api/auth/checkout/claim", { headers: apiHeaders(), data: { orderId: body.orderId, token: body.claimToken } });
    expect(claim.status()).toBe(403);
    expect((await claim.json()).code).toBe("CLAIM_REFUSED");

    const order = await db().order.findUniqueOrThrow({ where: { id: body.orderId } });
    expect(order.userId).toBe(owner.id); // the book went to the account, nothing else changed
    expect(order.claimedAt).toBeNull();
  });

  test("should refuse without creating an account when the phone number belongs to another account", async ({ page }) => {
    const owner = await createUser();
    const guest = newGuest({ phone: owner.phoneNumber! });
    await seedCart(page);
    await page.goto("/checkout");
    await fillGuest(page, guest);

    await page.getByRole("button", { name: /^Pay KES/ }).click();

    // The wording is deliberately generic (it must not confirm who owns a number) and carries a reference to quote.
    const alert = page.locator('p[role="alert"]');
    await expect(alert).toContainText("We could not use those details");
    await expect(alert).toContainText("Reference:");
    await expect(alert).not.toContainText(owner.phoneNumber!);
    expect(await db().user.findUnique({ where: { email: guest.email } })).toBeNull(); // no account made on the way
  });
});

test.describe("coupons", () => {
  test("should show the 10% discount and the reduced total when TEN is applied", async ({ page }) => {
    await seedCart(page);
    await page.goto("/checkout");
    const summary = page.locator('aside[aria-labelledby="sum"]');
    await expect(summary.getByText("Subtotal")).toBeVisible();

    await page.getByLabel("Coupon code").fill("TEN");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(summary.getByText("Discount (TEN)")).toBeVisible();
    await expect(summary.getByText("- KES 5", { exact: true })).toBeVisible();
    const fee = Number((await summary.locator("dt", { hasText: "Fees" }).locator("xpath=following-sibling::dd").innerText()).replace(/[^\d.]/g, "")) || 0;
    await expect(summary.getByRole("button", { name: `Pay KES ${(45 + fee).toLocaleString("en-KE")}` })).toBeVisible();
  });

  test("should show an error and keep the full price when the coupon code is unknown", async ({ page }) => {
    await seedCart(page);
    await page.goto("/checkout");
    await expect(page.getByRole("button", { name: /^Pay KES/ })).toBeVisible();

    await page.getByLabel("Coupon code").fill(`NOPE-${uid()}`);
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page.locator('p[role="alert"]')).toBeVisible();
    await expect(page.getByText("Discount (")).toHaveCount(0);
  });
});

test.describe("payment failure modal", () => {
  test("should show the reason, a countdown and an early-click warning when the checkout is locked", async ({ page }) => {
    await page.route("**/api/checkout", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 429,
            contentType: "application/json",
            body: JSON.stringify({ error: "Too many payment attempts. Try again in 1 minutes.", code: "PAY_LOCKED", retryAfterSeconds: 17, contactSupport: false }),
          })
        : route.continue(),
    );
    await seedCart(page);
    await page.goto("/checkout");
    await fillGuest(page, newGuest());

    await page.getByRole("button", { name: /^Pay KES/ }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Payment failed" })).toBeVisible();
    await expect(dialog.getByText("Too many payment attempts.")).toBeVisible();
    const retry = dialog.getByRole("button", { name: /^Try again/ });
    await expect(retry).toHaveText(/Try again in \d+s/);
    await expect(retry).toHaveAttribute("aria-disabled", "true");

    await retry.click({ force: true }); // too early; force, because Playwright treats aria-disabled as not clickable
    await expect(dialog.getByText("A current transaction is underway, please wait.")).toBeVisible();

    await expect(retry).toHaveText("Try again", { timeout: 25_000 });
    await expect(retry).toHaveAttribute("aria-disabled", "false");
  });

  test("should lock the payer after five counted attempts, and not count requests that fail on the cart", async ({ request }) => {
    const attempt = (editionIds: string[], coupon?: string) => {
      const g = newGuest();
      return request.post("/api/checkout", {
        headers: apiHeaders(),
        data: { editionIds, method: "card", coupon, turnstileToken: TURNSTILE_TOKEN, buyer: { firstName: g.first, lastName: g.last, email: g.email, phone: g.phone } },
      });
    };

    // Arrange/Act: six requests with a bad edition id fail on the cart, before the ladder.
    for (let i = 0; i < 6; i++) {
      const res = await attempt([`no-such-edition-${uid()}`]);
      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.status()).toBeLessThan(500);
      expect(res.status()).not.toBe(429);
    }
    // The ladder is still untouched: five real (free) attempts from the same address all go through.
    for (let i = 0; i < 5; i++) {
      const res = await attempt([EDITION], "FREE100");
      expect(res.status(), await res.text()).toBe(200);
    }
    // The sixth is locked, with a wait time and no "contact support" yet (that is the final 24 hour lock).
    const locked = await attempt([EDITION], "FREE100");
    expect(locked.status()).toBe(429);
    const body = await locked.json();
    expect(body.code).toBe("PAY_LOCKED");
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    expect(body.retryAfterSeconds).toBeLessThanOrEqual(300);
    expect(body.contactSupport).toBe(false);
  });
});

test.describe("navigation and gates", () => {
  test("should link the navbar user icon to the sign-in page", async ({ page }) => {
    await page.goto("/");
    const icon = page.locator('a[aria-label="Sign in"]:visible').first();
    await expect(icon).toHaveAttribute("href", "/sign-in");

    await icon.click();

    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("should send a signed-out visitor from /admin to sign-in", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fadmin/);
    await page.goto("/admin/sales");
    await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fadmin%2Fsales/);
  });

  test("should answer an ordinary signed-in reader with a 404 at /admin", async ({ page }) => {
    await signInAsNewReader(page.request);

    const res = await page.goto("/admin");

    expect(res?.status()).toBe(404); // not a redirect: the admin must not reveal that it exists
    await expect(page.getByRole("link", { name: "Audit log" })).toHaveCount(0);
  });
});

test.describe("api error shape", () => {
  test("should answer an empty checkout body with JSON 400 and an x-request-id header", async ({ request }) => {
    const res = await request.post("/api/checkout", { headers: apiHeaders(), data: {} });

    expect(res.status()).toBe(400);
    expect(res.headers()["content-type"]).toContain("application/json");
    expect(res.headers()["x-request-id"]).toBeTruthy();
    expect(typeof (await res.json()).error).toBe("string");
  });

  test("should echo the caller's x-request-id back", async ({ request }) => {
    const res = await request.post("/api/checkout", { headers: { ...apiHeaders(), "x-request-id": "e2e-trace-123" }, data: {} });

    expect(res.headers()["x-request-id"]).toBe("e2e-trace-123");
  });

  test("should include code and requestId in the body of a handled 400 from /api/checkout", async ({ request }) => {
    const res = await request.post("/api/checkout", { headers: apiHeaders(), data: {} });
    const body = await res.json();

    expect(body.code).toBeTruthy();
    expect(body.requestId).toBe(res.headers()["x-request-id"]);
  });

  test("should include code and requestId in the body when a route throws an AppError (community, signed out)", async ({ request }) => {
    const res = await request.post("/api/community", { headers: apiHeaders(), data: { kind: "comment", slug: BOOK_SLUG, body: "hello" } });
    const body = await res.json();

    expect(res.status()).toBe(401);
    expect(body.code).toBe("AUTH_REQUIRED");
    expect(body.requestId).toBe(res.headers()["x-request-id"]);
  });

  for (const [method, path] of [
    ["GET", "/api/orders/does-not-exist"],
    ["GET", "/api/notifications"],
    ["POST", "/api/contact"],
    ["POST", "/api/checkout/quote"],
  ] as const) {
    test(`should answer ${method} ${path} with JSON and an x-request-id header on error`, async ({ request }) => {
      const res = await request.fetch(path, { method, headers: apiHeaders(), data: method === "POST" ? {} : undefined });

      expect(res.status()).toBeGreaterThanOrEqual(400);
      expect(res.headers()["content-type"]).toContain("application/json");
      expect(res.headers()["x-request-id"]).toBeTruthy();
    });
  }
});

test.describe("comments", () => {
  test("should hold a new comment as PENDING and show it on the book page only once approved", async ({ page }) => {
    const reader = await signInAsNewReader(page.request);
    const text = `e2e comment ${uid()}`;

    const res = await page.request.post("/api/community", { headers: apiHeaders(), data: { kind: "comment", slug: BOOK_SLUG, body: text } });
    expect(res.status(), await res.text()).toBe(200);

    const row = await db().comment.findFirstOrThrow({ where: { body: text }, include: { user: true } });
    expect(row.status).toBe("PENDING");
    expect(row.user.email).toBe(reader.email);

    await page.goto(`/store/${BOOK_SLUG}`);
    await expect(page.getByRole("heading", { name: "Reader comments" })).toBeVisible();
    await expect(page.getByText(text)).toHaveCount(0);

    await db().comment.update({ where: { id: row.id }, data: { status: "APPROVED" } });
    await page.reload();
    await expect(page.getByText(text)).toBeVisible();
  });

  test("should refuse a comment on an unknown book without creating a row", async ({ page }) => {
    await signInAsNewReader(page.request);
    const text = `e2e orphan ${uid()}`;

    const res = await page.request.post("/api/community", { headers: apiHeaders(), data: { kind: "comment", slug: `no-such-book-${uid()}`, body: text } });

    expect(res.status()).toBe(404);
    expect((await res.json()).code).toBe("COMMUNITY_BOOK_NOT_FOUND");
    expect(await db().comment.count({ where: { body: text } })).toBe(0);
  });
});

// Not covered here, on purpose (need real provider secrets; the logic is covered by unit tests under lib/):
test.describe("needs real provider secrets", () => {
  test.skip("a card payment completes through the Paystack popup (needs a Paystack test key and a reachable api.paystack.co)", () => {});
  test.skip("an M-Pesa STK push is confirmed by the Daraja callback (needs Daraja sandbox credentials and a public callback URL)", () => {});
  test.skip("sign-in email codes arrive through Resend (needs RESEND_API_KEY; the dev server prints the code instead)", () => {});
  test.skip("the Turnstile bot check blocks a guest checkout without a token (the spec stubs the widget and uses Cloudflare's always-pass test keys, so a failing check cannot be shown)", () => {});
});
