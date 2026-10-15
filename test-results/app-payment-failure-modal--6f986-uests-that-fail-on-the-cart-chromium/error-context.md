# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> payment failure modal >> should lock the payer after five counted attempts, and not count requests that fail on the cart
- Location: e2e\app.spec.ts:204:7

# Error details

```
Error: {"error":"Please complete the security check.","code":"CHECKOUT_BOT_CHECK_FAILED","requestId":"e4b19712-7df8-490b-bfc5-e17af02cadb7"}

expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 400
```

# Test source

```ts
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
  167 | 
  168 |     await expect(page.locator('p[role="alert"]')).toBeVisible();
  169 |     await expect(page.getByText("Discount (")).toHaveCount(0);
  170 |   });
  171 | });
  172 | 
  173 | test.describe("payment failure modal", () => {
  174 |   test("should show the reason, a countdown and an early-click warning when the checkout is locked", async ({ page }) => {
  175 |     await page.route("**/api/checkout", (route) =>
  176 |       route.request().method() === "POST"
  177 |         ? route.fulfill({
  178 |             status: 429,
  179 |             contentType: "application/json",
  180 |             body: JSON.stringify({ error: "Too many payment attempts. Try again in 1 minutes.", code: "PAY_LOCKED", retryAfterSeconds: 17, contactSupport: false }),
  181 |           })
  182 |         : route.continue(),
  183 |     );
  184 |     await seedCart(page);
  185 |     await page.goto("/checkout");
  186 |     await fillGuest(page, newGuest());
  187 | 
  188 |     await page.getByRole("button", { name: /^Pay KES/ }).click();
  189 | 
  190 |     const dialog = page.getByRole("dialog");
  191 |     await expect(dialog.getByRole("heading", { name: "Payment failed" })).toBeVisible();
  192 |     await expect(dialog.getByText("Too many payment attempts.")).toBeVisible();
  193 |     const retry = dialog.getByRole("button", { name: /^Try again/ });
  194 |     await expect(retry).toHaveText(/Try again in \d+s/);
  195 |     await expect(retry).toHaveAttribute("aria-disabled", "true");
  196 | 
  197 |     await retry.click(); // too early
  198 |     await expect(dialog.getByText("A current transaction is underway, please wait.")).toBeVisible();
  199 | 
  200 |     await expect(retry).toHaveText("Try again", { timeout: 25_000 });
  201 |     await expect(retry).toHaveAttribute("aria-disabled", "false");
  202 |   });
  203 | 
  204 |   test("should lock the payer after five counted attempts, and not count requests that fail on the cart", async ({ request }) => {
  205 |     const attempt = (editionIds: string[], coupon?: string) => {
  206 |       const g = newGuest();
  207 |       return request.post("/api/checkout", {
  208 |         headers: apiHeaders(),
  209 |         data: { editionIds, method: "card", coupon, buyer: { firstName: g.first, lastName: g.last, email: g.email, phone: g.phone } },
  210 |       });
  211 |     };
  212 | 
  213 |     // Arrange/Act: six requests with a bad edition id fail on the cart, before the ladder.
  214 |     for (let i = 0; i < 6; i++) {
  215 |       const res = await attempt([`no-such-edition-${uid()}`]);
  216 |       expect(res.status()).toBeGreaterThanOrEqual(400);
  217 |       expect(res.status()).toBeLessThan(500);
  218 |       expect(res.status()).not.toBe(429);
  219 |     }
  220 |     // The ladder is still untouched: five real (free) attempts from the same address all go through.
  221 |     for (let i = 0; i < 5; i++) {
  222 |       const res = await attempt([EDITION], "FREE100");
> 223 |       expect(res.status(), await res.text()).toBe(200);
      |                                              ^ Error: {"error":"Please complete the security check.","code":"CHECKOUT_BOT_CHECK_FAILED","requestId":"e4b19712-7df8-490b-bfc5-e17af02cadb7"}
  224 |     }
  225 |     // The sixth is locked, with a wait time and no "contact support" yet (that is the final 24 hour lock).
  226 |     const locked = await attempt([EDITION], "FREE100");
  227 |     expect(locked.status()).toBe(429);
  228 |     const body = await locked.json();
  229 |     expect(body.code).toBe("PAY_LOCKED");
  230 |     expect(body.retryAfterSeconds).toBeGreaterThan(0);
  231 |     expect(body.retryAfterSeconds).toBeLessThanOrEqual(300);
  232 |     expect(body.contactSupport).toBe(false);
  233 |   });
  234 | });
  235 | 
  236 | test.describe("navigation and gates", () => {
  237 |   test("should link the navbar user icon to the sign-in page", async ({ page }) => {
  238 |     await page.goto("/");
  239 |     const icon = page.locator('a[aria-label="Sign in"]:visible').first();
  240 |     await expect(icon).toHaveAttribute("href", "/sign-in");
  241 | 
  242 |     await icon.click();
  243 | 
  244 |     await expect(page).toHaveURL(/\/sign-in/);
  245 |   });
  246 | 
  247 |   test("should send a signed-out visitor from /admin to sign-in", async ({ page }) => {
  248 |     await page.goto("/admin");
  249 |     await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fadmin/);
  250 |     await page.goto("/admin/sales");
  251 |     await expect(page).toHaveURL(/\/sign-in\?redirect=%2Fadmin%2Fsales/);
  252 |   });
  253 | 
  254 |   test("should keep an ordinary signed-in reader out of the admin", async ({ page }) => {
  255 |     await signInAsNewReader(page.request);
  256 | 
  257 |     await page.goto("/admin");
  258 | 
  259 |     await expect(page).not.toHaveURL(/\/admin(\/|$)/);
  260 |   });
  261 | });
  262 | 
  263 | test.describe("api error shape", () => {
  264 |   test("should answer an empty checkout body with JSON 400 and an x-request-id header", async ({ request }) => {
  265 |     const res = await request.post("/api/checkout", { headers: apiHeaders(), data: {} });
  266 | 
  267 |     expect(res.status()).toBe(400);
  268 |     expect(res.headers()["content-type"]).toContain("application/json");
  269 |     expect(res.headers()["x-request-id"]).toBeTruthy();
  270 |     expect(typeof (await res.json()).error).toBe("string");
  271 |   });
  272 | 
  273 |   test("should echo the caller's x-request-id back", async ({ request }) => {
  274 |     const res = await request.post("/api/checkout", { headers: { ...apiHeaders(), "x-request-id": "e2e-trace-123" }, data: {} });
  275 | 
  276 |     expect(res.headers()["x-request-id"]).toBe("e2e-trace-123");
  277 |   });
  278 | 
  279 |   test("should include code and requestId in the body of a handled 400 from /api/checkout", async ({ request }) => {
  280 |     const res = await request.post("/api/checkout", { headers: apiHeaders(), data: {} });
  281 |     const body = await res.json();
  282 | 
  283 |     expect(body.code).toBeTruthy();
  284 |     expect(body.requestId).toBe(res.headers()["x-request-id"]);
  285 |   });
  286 | 
  287 |   test("should include code and requestId in the body when a route throws an AppError (community, signed out)", async ({ request }) => {
  288 |     const res = await request.post("/api/community", { headers: apiHeaders(), data: { kind: "comment", slug: BOOK_SLUG, body: "hello" } });
  289 |     const body = await res.json();
  290 | 
  291 |     expect(res.status()).toBe(401);
  292 |     expect(body.code).toBe("AUTH_REQUIRED");
  293 |     expect(body.requestId).toBe(res.headers()["x-request-id"]);
  294 |   });
  295 | 
  296 |   for (const [method, path] of [
  297 |     ["GET", "/api/orders/does-not-exist"],
  298 |     ["GET", "/api/notifications"],
  299 |     ["POST", "/api/contact"],
  300 |     ["POST", "/api/checkout/quote"],
  301 |   ] as const) {
  302 |     test(`should answer ${method} ${path} with JSON and an x-request-id header on error`, async ({ request }) => {
  303 |       const res = await request.fetch(path, { method, headers: apiHeaders(), data: method === "POST" ? {} : undefined });
  304 | 
  305 |       expect(res.status()).toBeGreaterThanOrEqual(400);
  306 |       expect(res.headers()["content-type"]).toContain("application/json");
  307 |       expect(res.headers()["x-request-id"]).toBeTruthy();
  308 |     });
  309 |   }
  310 | });
  311 | 
  312 | test.describe("comments", () => {
  313 |   test("should hold a new comment as PENDING and show it on the book page only once approved", async ({ page }) => {
  314 |     const reader = await signInAsNewReader(page.request);
  315 |     const text = `e2e comment ${uid()}`;
  316 | 
  317 |     const res = await page.request.post("/api/community", { headers: apiHeaders(), data: { kind: "comment", slug: BOOK_SLUG, body: text } });
  318 |     expect(res.status(), await res.text()).toBe(200);
  319 | 
  320 |     const row = await db().comment.findFirstOrThrow({ where: { body: text }, include: { user: true } });
  321 |     expect(row.status).toBe("PENDING");
  322 |     expect(row.user.email).toBe(reader.email);
  323 | 
```