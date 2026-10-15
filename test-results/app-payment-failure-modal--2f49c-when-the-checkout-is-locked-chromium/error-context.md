# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> payment failure modal >> should show the reason, a countdown and an early-click warning when the checkout is locked
- Location: e2e\app.spec.ts:174:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog').getByRole('heading', { name: 'Payment failed' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog').getByRole('heading', { name: 'Payment failed' }) with timeout 20000ms
  - waiting for getByRole('dialog').getByRole('heading', { name: 'Payment failed' })

```

```yaml
- banner:
  - navigation "Main":
    - list:
      - listitem:
        - link "Home":
          - /url: /
      - listitem:
        - link "About Me":
          - /url: /about
      - listitem:
        - link "Store":
          - /url: /store
      - listitem:
        - link "Services":
          - /url: /services
    - link "Get My Book":
      - /url: /store/from-pieces-to-power
    - link "Sign in":
      - /url: /sign-in
- main:
  - heading "Checkout" [level=1]
  - region "1 Your details":
    - heading "1 Your details" [level=2]
    - paragraph: We create your account from these details, so you can read and listen straight after paying.
    - text: First name
    - textbox "First name": Ada
    - text: Last name
    - textbox "Last name": Tester
    - text: Email
    - textbox "Email": e2e-n5ocmvps@example.test
    - text: Phone number
    - combobox "Country code":
      - option "🇦🇫 +93 (AF)"
      - option "🇦🇽 +35818 (AX)"
      - option "🇦🇱 +355 (AL)"
      - option "🇩🇿 +213 (DZ)"
      - option "🇦🇸 +1684 (AS)"
      - option "🇦🇩 +376 (AD)"
      - option "🇦🇴 +244 (AO)"
      - option "🇦🇮 +1264 (AI)"
      - option "🇦🇬 +1268 (AG)"
      - option "🇦🇷 +54 (AR)"
      - option "🇦🇲 +374 (AM)"
      - option "🇦🇼 +297 (AW)"
      - option "🇦🇺 +61 (AU)"
      - option "🇦🇹 +43 (AT)"
      - option "🇦🇿 +994 (AZ)"
      - option "🇧🇸 +1242 (BS)"
      - option "🇧🇭 +973 (BH)"
      - option "🇧🇩 +880 (BD)"
      - option "🇧🇧 +1246 (BB)"
      - option "🇧🇾 +375 (BY)"
      - option "🇧🇪 +32 (BE)"
      - option "🇧🇿 +501 (BZ)"
      - option "🇧🇯 +229 (BJ)"
      - option "🇧🇲 +1441 (BM)"
      - option "🇧🇹 +975 (BT)"
      - option "🇧🇴 +591 (BO)"
      - option "🇧🇦 +387 (BA)"
      - option "🇧🇼 +267 (BW)"
      - option "🇧🇻 +47 (BV)"
      - option "🇧🇷 +55 (BR)"
      - option "🇮🇴 +246 (IO)"
      - option "🇻🇬 +1284 (VG)"
      - option "🇧🇳 +673 (BN)"
      - option "🇧🇬 +359 (BG)"
      - option "🇧🇫 +226 (BF)"
      - option "🇧🇮 +257 (BI)"
      - option "🇰🇭 +855 (KH)"
      - option "🇨🇲 +237 (CM)"
      - option "🇨🇦 +1 (CA)"
      - option "🇨🇻 +238 (CV)"
      - option "🇰🇾 +1345 (KY)"
      - option "🇨🇫 +236 (CF)"
      - option "🇹🇩 +235 (TD)"
      - option "🇨🇱 +56 (CL)"
      - option "🇨🇳 +86 (CN)"
      - option "🇨🇽 +61 (CX)"
      - option "🇨🇨 +61 (CC)"
      - option "🇨🇴 +57 (CO)"
      - option "🇰🇲 +269 (KM)"
      - option "🇨🇬 +242 (CG)"
      - option "🇨🇰 +682 (CK)"
      - option "🇨🇷 +506 (CR)"
      - option "🇭🇷 +385 (HR)"
      - option "🇨🇺 +53 (CU)"
      - option "🇨🇼 +599 (CW)"
      - option "🇨🇾 +357 (CY)"
      - option "🇨🇿 +420 (CZ)"
      - option "🇩🇰 +45 (DK)"
      - option "🇩🇯 +253 (DJ)"
      - option "🇩🇲 +1767 (DM)"
      - option "🇩🇴 +1 (DO)"
      - option "🇨🇩 +243 (CD)"
      - option "🇪🇨 +593 (EC)"
      - option "🇪🇬 +20 (EG)"
      - option "🇸🇻 +503 (SV)"
      - option "🇬🇶 +240 (GQ)"
      - option "🇪🇷 +291 (ER)"
      - option "🇪🇪 +372 (EE)"
      - option "🇸🇿 +268 (SZ)"
      - option "🇪🇹 +251 (ET)"
      - option "🇫🇰 +500 (FK)"
      - option "🇫🇴 +298 (FO)"
      - option "🇫🇯 +679 (FJ)"
      - option "🇫🇮 +358 (FI)"
      - option "🇫🇷 +33 (FR)"
      - option "🇬🇫 +594 (GF)"
      - option "🇵🇫 +689 (PF)"
      - option "🇹🇫 +262 (TF)"
      - option "🇬🇦 +241 (GA)"
      - option "🇬🇲 +220 (GM)"
      - option "🇬🇪 +995 (GE)"
      - option "🇩🇪 +49 (DE)"
      - option "🇬🇭 +233 (GH)"
      - option "🇬🇮 +350 (GI)"
      - option "🇬🇷 +30 (GR)"
      - option "🇬🇱 +299 (GL)"
      - option "🇬🇩 +1473 (GD)"
      - option "🇬🇵 +590 (GP)"
      - option "🇬🇺 +1671 (GU)"
      - option "🇬🇹 +502 (GT)"
      - option "🇬🇬 +44 (GG)"
      - option "🇬🇳 +224 (GN)"
      - option "🇬🇼 +245 (GW)"
      - option "🇬🇾 +592 (GY)"
      - option "🇭🇹 +509 (HT)"
      - option "🇭🇳 +504 (HN)"
      - option "🇭🇰 +852 (HK)"
      - option "🇭🇺 +36 (HU)"
      - option "🇮🇸 +354 (IS)"
      - option "🇮🇳 +91 (IN)"
      - option "🇮🇩 +62 (ID)"
      - option "🇮🇷 +98 (IR)"
      - option "🇮🇶 +964 (IQ)"
      - option "🇮🇪 +353 (IE)"
      - option "🇮🇲 +44 (IM)"
      - option "🇮🇱 +972 (IL)"
      - option "🇮🇹 +39 (IT)"
      - option "🇨🇮 +225 (CI)"
      - option "🇯🇲 +1876 (JM)"
      - option "🇯🇵 +81 (JP)"
      - option "🇯🇪 +44 (JE)"
      - option "🇯🇴 +962 (JO)"
      - option "🇰🇿 +7 (KZ)"
      - option "🇰🇪 +254 (KE)" [selected]
      - option "🇰🇮 +686 (KI)"
      - option "🇽🇰 +383 (XK)"
      - option "🇰🇼 +965 (KW)"
      - option "🇰🇬 +996 (KG)"
      - option "🇱🇦 +856 (LA)"
      - option "🇱🇻 +371 (LV)"
      - option "🇱🇧 +961 (LB)"
      - option "🇱🇸 +266 (LS)"
      - option "🇱🇷 +231 (LR)"
      - option "🇱🇾 +218 (LY)"
      - option "🇱🇮 +423 (LI)"
      - option "🇱🇹 +370 (LT)"
      - option "🇱🇺 +352 (LU)"
      - option "🇲🇴 +853 (MO)"
      - option "🇲🇬 +261 (MG)"
      - option "🇲🇼 +265 (MW)"
      - option "🇲🇾 +60 (MY)"
      - option "🇲🇻 +960 (MV)"
      - option "🇲🇱 +223 (ML)"
      - option "🇲🇹 +356 (MT)"
      - option "🇲🇭 +692 (MH)"
      - option "🇲🇶 +596 (MQ)"
      - option "🇲🇷 +222 (MR)"
      - option "🇲🇺 +230 (MU)"
      - option "🇾🇹 +262 (YT)"
      - option "🇲🇽 +52 (MX)"
      - option "🇫🇲 +691 (FM)"
      - option "🇲🇩 +373 (MD)"
      - option "🇲🇨 +377 (MC)"
      - option "🇲🇳 +976 (MN)"
      - option "🇲🇪 +382 (ME)"
      - option "🇲🇸 +1664 (MS)"
      - option "🇲🇦 +212 (MA)"
      - option "🇲🇿 +258 (MZ)"
      - option "🇲🇲 +95 (MM)"
      - option "🇳🇦 +264 (NA)"
      - option "🇳🇷 +674 (NR)"
      - option "🇳🇵 +977 (NP)"
      - option "🇳🇱 +31 (NL)"
      - option "🇳🇨 +687 (NC)"
      - option "🇳🇿 +64 (NZ)"
      - option "🇳🇮 +505 (NI)"
      - option "🇳🇪 +227 (NE)"
      - option "🇳🇬 +234 (NG)"
      - option "🇳🇺 +683 (NU)"
      - option "🇳🇫 +672 (NF)"
      - option "🇰🇵 +850 (KP)"
      - option "🇲🇰 +389 (MK)"
      - option "🇲🇵 +1670 (MP)"
      - option "🇳🇴 +47 (NO)"
      - option "🇴🇲 +968 (OM)"
      - option "🇵🇰 +92 (PK)"
      - option "🇵🇼 +680 (PW)"
      - option "🇵🇸 +970 (PS)"
      - option "🇵🇦 +507 (PA)"
      - option "🇵🇬 +675 (PG)"
      - option "🇵🇾 +595 (PY)"
      - option "🇵🇪 +51 (PE)"
      - option "🇵🇭 +63 (PH)"
      - option "🇵🇳 +64 (PN)"
      - option "🇵🇱 +48 (PL)"
      - option "🇵🇹 +351 (PT)"
      - option "🇵🇷 +1 (PR)"
      - option "🇶🇦 +974 (QA)"
      - option "🇷🇪 +262 (RE)"
      - option "🇷🇴 +40 (RO)"
      - option "🇷🇺 +7 (RU)"
      - option "🇷🇼 +250 (RW)"
      - option "🇧🇱 +590 (BL)"
      - option "🇸🇭 +2 (SH)"
      - option "🇰🇳 +1869 (KN)"
      - option "🇱🇨 +1758 (LC)"
      - option "🇲🇫 +590 (MF)"
      - option "🇵🇲 +508 (PM)"
      - option "🇻🇨 +1784 (VC)"
      - option "🇼🇸 +685 (WS)"
      - option "🇸🇲 +378 (SM)"
      - option "🇸🇹 +239 (ST)"
      - option "🇸🇦 +966 (SA)"
      - option "🇸🇳 +221 (SN)"
      - option "🇷🇸 +381 (RS)"
      - option "🇸🇨 +248 (SC)"
      - option "🇸🇱 +232 (SL)"
      - option "🇸🇬 +65 (SG)"
      - option "🇸🇽 +1721 (SX)"
      - option "🇸🇰 +421 (SK)"
      - option "🇸🇮 +386 (SI)"
      - option "🇸🇧 +677 (SB)"
      - option "🇸🇴 +252 (SO)"
      - option "🇿🇦 +27 (ZA)"
      - option "🇬🇸 +500 (GS)"
      - option "🇰🇷 +82 (KR)"
      - option "🇸🇸 +211 (SS)"
      - option "🇪🇸 +34 (ES)"
      - option "🇱🇰 +94 (LK)"
      - option "🇸🇩 +249 (SD)"
      - option "🇸🇷 +597 (SR)"
      - option "🇸🇯 +4779 (SJ)"
      - option "🇸🇪 +46 (SE)"
      - option "🇨🇭 +41 (CH)"
      - option "🇸🇾 +963 (SY)"
      - option "🇹🇼 +886 (TW)"
      - option "🇹🇯 +992 (TJ)"
      - option "🇹🇿 +255 (TZ)"
      - option "🇹🇭 +66 (TH)"
      - option "🇹🇱 +670 (TL)"
      - option "🇹🇬 +228 (TG)"
      - option "🇹🇰 +690 (TK)"
      - option "🇹🇴 +676 (TO)"
      - option "🇹🇹 +1868 (TT)"
      - option "🇹🇳 +216 (TN)"
      - option "🇹🇷 +90 (TR)"
      - option "🇹🇲 +993 (TM)"
      - option "🇹🇨 +1649 (TC)"
      - option "🇹🇻 +688 (TV)"
      - option "🇺🇬 +256 (UG)"
      - option "🇺🇦 +380 (UA)"
      - option "🇦🇪 +971 (AE)"
      - option "🇬🇧 +44 (GB)"
      - option "🇺🇸 +1 (US)"
      - option "🇺🇲 +268 (UM)"
      - option "🇻🇮 +1340 (VI)"
      - option "🇺🇾 +598 (UY)"
      - option "🇺🇿 +998 (UZ)"
      - option "🇻🇺 +678 (VU)"
      - option "🇻🇦 +3 (VA)"
      - option "🇻🇪 +58 (VE)"
      - option "🇻🇳 +84 (VN)"
      - option "🇼🇫 +681 (WF)"
      - option "🇪🇭 +2 (EH)"
      - option "🇾🇪 +967 (YE)"
      - option "🇿🇲 +260 (ZM)"
      - option "🇿🇼 +263 (ZW)"
    - text: Phone number
    - textbox "Phone number":
      - /placeholder: 712 345 678
      - text: "765417439"
    - paragraph: "Already have an account with this email? Just pay: the book is added to it, then sign in with a code."
  - region "2 Payment method":
    - heading "2 Payment method" [level=2]
    - radiogroup "Payment method":
      - radio "Card Visa or Mastercard, secured by Paystack" [checked]
      - text: Card Visa or Mastercard, secured by Paystack
  - complementary "Order summary":
    - heading "Order summary" [level=2]
    - list:
      - listitem: Test Media Book KES 50
    - textbox "Coupon code"
    - button "Apply"
    - term: Subtotal
    - definition: KES 50
    - term: Discount
    - definition: KES 0
    - term: Fees
    - definition: KES 0
    - term: Total
    - definition: KES 50
    - alert: Please complete the security check.
    - button "Pay KES 50"
    - paragraph: You are only charged once the payment provider confirms it.
- contentinfo:
  - text: ♥ Wangeci
  - paragraph: Author, entrepreneur and former journalist Wangeci Kariuki—turning pieces into power, one story at a time.
  - heading "Explore" [level=4]
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "About Me":
        - /url: /about
    - listitem:
      - link "Store":
        - /url: /store
    - listitem:
      - link "Services":
        - /url: /services
  - heading "Her Ventures" [level=4]
  - list:
    - listitem: Fechi Organics
    - listitem: Blissful Oasis
    - listitem: Home Care Solutions
  - heading "Contact Us" [level=4]
  - list:
    - listitem: TODO(client)
    - listitem: TODO(client)
    - listitem: TODO(client)
  - separator
  - text: Powered by
  - link "Kyfaru Kyfaru":
    - /url: https://kyfaru.com
    - img "Kyfaru"
    - text: Kyfaru
  - navigation "Legal":
    - link "Contact":
      - /url: /contact
    - link "Terms":
      - /url: /terms
    - link "Privacy":
      - /url: /privacy
    - link "Refunds":
      - /url: /refunds
    - link "Cookies":
      - /url: /cookies
  - paragraph: © 2026 Wangeci Kariuki. All rights reserved.
  - img: Wangeci Wangeci Wangeci
- alert
```

# Test source

```ts
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
> 191 |     await expect(dialog.getByRole("heading", { name: "Payment failed" })).toBeVisible();
      |                                                                           ^ Error: expect(locator).toBeVisible() failed
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
```