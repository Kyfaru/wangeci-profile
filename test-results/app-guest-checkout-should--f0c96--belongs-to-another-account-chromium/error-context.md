# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> guest checkout >> should refuse with a clear message when the phone number belongs to another account
- Location: e2e\app.spec.ts:130:7

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('p[role="alert"]')
Expected substring: "already used by another account"
Received string:    "Please complete the security check."
Timeout: 20000ms

Call log:
  - Expect "toContainText" locator('p[role="alert"]') with timeout 20000ms
  - waiting for locator('p[role="alert"]')
    42 × locator resolved to <p role="alert" class="mt-4 text-sm text-error">Please complete the security check.</p>
       - unexpected value "Please complete the security check."

```

```yaml
- alert: Please complete the security check.
```

# Test source

```ts
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
  66  |   expect(res.status(), await res.text()).toBe(200);
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
> 139 |     await expect(page.locator('p[role="alert"]')).toContainText("already used by another account");
      |                                                   ^ Error: expect(locator).toContainText(expected) failed
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
  223 |       expect(res.status(), await res.text()).toBe(200);
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
```