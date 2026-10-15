# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> navigation and gates >> should keep an ordinary signed-in reader out of the admin
- Location: e2e\app.spec.ts:254:7

# Error details

```
Error: {"error":"Please complete the security check.","code":"CHECKOUT_BOT_CHECK_FAILED","requestId":"8d08de9e-a62f-4396-800a-fde4af28fea1"}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 400
```

# Test source

```ts
  1   | import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
  2   | 
  3   | import { createUser, db, e2eEmail, e2ePhone, nationalOf, uid } from "./db";
  4   | 
  5   | /**
  6   |  * End-to-end specs for the money path, sign-in rules, error shape and comment moderation.
  7   |  * Everything runs against the local database. Anything that needs a real Paystack, Daraja, Resend or
  8   |  * Turnstile secret is skipped with a reason (see the bottom of the file).
  9   |  */
  10  | 
  11  | const BASE = `http://localhost:${process.env.E2E_PORT ?? 3123}`;
  12  | const BOOK_SLUG = "test-media-book";
  13  | const EDITION = "test-ebook"; // KES 50
  14  | 
  15  | /** Each test gets its own "network address" so the per-IP checkout limits of one test never hit another. */
  16  | const fakeIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
  17  | 
  18  | let ip = fakeIp();
  19  | test.beforeEach(async ({ context }) => {
  20  |   ip = fakeIp();
  21  |   await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  22  | });
  23  | 
  24  | const apiHeaders = () => ({ "x-forwarded-for": ip, origin: BASE });
  25  | 
  26  | /** Puts one book in the browser's cart, the same way the store does (zustand `wangeci-cart`). */
  27  | async function seedCart(page: Page, editionId = EDITION, price = 50) {
  28  |   await page.addInitScript(
  29  |     ([id, p]) => {
  30  |       try {
  31  |         if (!localStorage.getItem("wangeci-cart")) {
  32  |           const item = { id: `book:x:${id}`, itemId: "x", editionId: id, type: "book", title: "Test Media Book", price: p, currency: "KES", qty: 1 };
  33  |           localStorage.setItem("wangeci-cart", JSON.stringify({ state: { items: [item] }, version: 0 }));
  34  |         }
  35  |       } catch {
  36  |         /* storage unavailable: the spec fails visibly on the checkout page instead */
  37  |       }
  38  |     },
  39  |     [editionId, price] as const,
  40  |   );
  41  | }
  42  | 
  43  | interface Guest {
  44  |   first: string;
  45  |   last: string;
  46  |   email: string;
  47  |   phone: string; // E.164
  48  | }
  49  | const newGuest = (over: Partial<Guest> = {}): Guest => ({ first: "Ada", last: "Tester", email: e2eEmail(), phone: e2ePhone(), ...over });
  50  | 
  51  | async function fillGuest(page: Page, g: Guest) {
  52  |   const details = page.locator('section[aria-labelledby="s1"]');
  53  |   await details.getByLabel("First name").fill(g.first);
  54  |   await details.getByLabel("Last name").fill(g.last);
  55  |   await details.getByLabel("Email").fill(g.email);
  56  |   await details.getByPlaceholder("712 345 678").fill(nationalOf(g.phone));
  57  | }
  58  | 
  59  | /** Free guest purchase over the API, then the paying device claims its session (what the browser does). */
  60  | async function signInAsNewReader(request: APIRequestContext) {
  61  |   const guest = newGuest();
  62  |   const res = await request.post("/api/checkout", {
  63  |     headers: apiHeaders(),
  64  |     data: { editionIds: [EDITION], method: "card", coupon: "FREE100", buyer: { firstName: guest.first, lastName: guest.last, email: guest.email, phone: guest.phone } },
  65  |   });
> 66  |   expect(res.status(), await res.text()).toBe(200);
      |                                          ^ Error: {"error":"Please complete the security check.","code":"CHECKOUT_BOT_CHECK_FAILED","requestId":"8d08de9e-a62f-4396-800a-fde4af28fea1"}
  67  |   const order = (await res.json()) as { orderId: string; claimToken: string };
  68  |   const claim = await request.post("/api/auth/checkout/claim", { headers: apiHeaders(), data: { orderId: order.orderId, token: order.claimToken } });
  69  |   expect(claim.status(), await claim.text()).toBe(200);
  70  |   return guest;
  71  | }
  72  | 
  73  | test.describe("guest checkout", () => {
  74  |   test("should sign the device in and reach the dashboard when a new guest pays with a 100% coupon", async ({ page, context }) => {
  75  |     const guest = newGuest();
  76  |     await seedCart(page);
  77  |     await page.goto("/checkout");
  78  |     await fillGuest(page, guest);
  79  |     await page.getByLabel("Coupon code").fill("FREE100");
  80  |     await page.getByRole("button", { name: "Apply" }).click();
  81  |     const pay = page.getByRole("button", { name: "Get my book" });
  82  |     await expect(pay).toBeVisible();
  83  | 
  84  |     const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/checkout" && r.request().method() === "POST");
  85  |     await pay.click();
  86  |     const body = await (await response).json();
  87  | 
  88  |     expect(body.free).toBe(true);
  89  |     await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible();
  90  |     await page.waitForURL(/\/checkout\/success\?ref=/);
  91  |     await page.getByRole("link", { name: "Go to dashboard" }).click();
  92  |     await expect(page).toHaveURL(/\/dashboard/);
  93  |     expect((await context.cookies()).some((c) => c.name.includes("session_token"))).toBe(true);
  94  | 
  95  |     const order = await db().order.findUniqueOrThrow({ where: { id: body.orderId }, include: { user: true } });
  96  |     expect(order.status).toBe("PAID");
  97  |     expect(order.user.email).toBe(guest.email);
  98  |     expect(order.accountCreated).toBe(true);
  99  |     expect(order.claimedAt).not.toBeNull();
  100 |   });
  101 | 
  102 |   test("should not sign the device in when the guest uses the email of an existing account", async ({ page }) => {
  103 |     const owner = await createUser();
  104 |     const guest = newGuest({ email: owner.email });
  105 |     await seedCart(page);
  106 |     await page.goto("/checkout");
  107 |     await fillGuest(page, guest);
  108 |     await page.getByLabel("Coupon code").fill("FREE100");
  109 |     await page.getByRole("button", { name: "Apply" }).click();
  110 | 
  111 |     const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/checkout" && r.request().method() === "POST");
  112 |     await page.getByRole("button", { name: "Get my book" }).click();
  113 |     const body = (await (await response).json()) as { orderId: string; claimToken: string; free: boolean };
  114 |     expect(body.free).toBe(true);
  115 |     await page.waitForURL(/\/checkout\/success\?ref=/);
  116 | 
  117 |     await page.goto("/dashboard");
  118 |     await expect(page).toHaveURL(/\/sign-in/);
  119 | 
  120 |     // Even holding the paying device's own token, an existing account can never be claimed.
  121 |     const claim = await page.request.post("/api/auth/checkout/claim", { headers: apiHeaders(), data: { orderId: body.orderId, token: body.claimToken } });
  122 |     expect(claim.status()).toBe(403);
  123 |     expect((await claim.json()).code).toBe("CLAIM_REFUSED");
  124 | 
  125 |     const order = await db().order.findUniqueOrThrow({ where: { id: body.orderId } });
  126 |     expect(order.userId).toBe(owner.id); // the book went to the account, nothing else changed
  127 |     expect(order.claimedAt).toBeNull();
  128 |   });
  129 | 
  130 |   test("should refuse with a clear message when the phone number belongs to another account", async ({ page }) => {
  131 |     const owner = await createUser();
  132 |     const guest = newGuest({ phone: owner.phoneNumber! });
  133 |     await seedCart(page);
  134 |     await page.goto("/checkout");
  135 |     await fillGuest(page, guest);
  136 | 
  137 |     await page.getByRole("button", { name: /^Pay KES/ }).click();
  138 | 
  139 |     await expect(page.locator('p[role="alert"]')).toContainText("already used by another account");
  140 |     expect(await db().user.findUnique({ where: { email: guest.email } })).toBeNull(); // no account made on the way
  141 |   });
  142 | });
  143 | 
  144 | test.describe("coupons", () => {
  145 |   test("should show the 10% discount and the reduced total when TEN is applied", async ({ page }) => {
  146 |     await seedCart(page);
  147 |     await page.goto("/checkout");
  148 |     const summary = page.locator('aside[aria-labelledby="sum"]');
  149 |     await expect(summary.getByText("Subtotal")).toBeVisible();
  150 | 
  151 |     await page.getByLabel("Coupon code").fill("TEN");
  152 |     await page.getByRole("button", { name: "Apply" }).click();
  153 | 
  154 |     await expect(summary.getByText("Discount (TEN)")).toBeVisible();
  155 |     await expect(summary.getByText("- KES 5", { exact: true })).toBeVisible();
  156 |     const fee = Number((await summary.locator("dt", { hasText: "Fees" }).locator("xpath=following-sibling::dd").innerText()).replace(/[^\d.]/g, "")) || 0;
  157 |     await expect(summary.getByRole("button", { name: `Pay KES ${(45 + fee).toLocaleString("en-KE")}` })).toBeVisible();
  158 |   });
  159 | 
  160 |   test("should show an error and keep the full price when the coupon code is unknown", async ({ page }) => {
  161 |     await seedCart(page);
  162 |     await page.goto("/checkout");
  163 |     await expect(page.getByRole("button", { name: /^Pay KES/ })).toBeVisible();
  164 | 
  165 |     await page.getByLabel("Coupon code").fill(`NOPE-${uid()}`);
  166 |     await page.getByRole("button", { name: "Apply" }).click();
```