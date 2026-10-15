# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app.spec.ts >> guest checkout >> should sign the device in and reach the dashboard when a new guest pays with a 100% coupon
- Location: e2e\app.spec.ts:74:7

# Error details

```
Test timeout of 120000ms exceeded.
```

```
Error: page.waitForResponse: Test timeout of 120000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - banner [ref=e2]:
    - navigation "Main" [ref=e3]:
      - list [ref=e4]:
        - listitem [ref=e5]:
          - link "Home" [ref=e6] [cursor=pointer]:
            - /url: /
        - listitem [ref=e7]:
          - link "About Me" [ref=e8] [cursor=pointer]:
            - /url: /about
        - listitem [ref=e9]:
          - link "Store" [ref=e10] [cursor=pointer]:
            - /url: /store
        - listitem [ref=e11]:
          - link "Services" [ref=e12] [cursor=pointer]:
            - /url: /services
      - generic [ref=e13]:
        - link "Get My Book" [ref=e14] [cursor=pointer]:
          - /url: /store/from-pieces-to-power
        - link "Sign in" [ref=e15] [cursor=pointer]:
          - /url: /sign-in
  - main [ref=e17]:
    - generic [ref=e18]:
      - heading "Checkout" [level=1] [ref=e19]
      - generic [ref=e20]:
        - generic [ref=e21]:
          - region [ref=e22]:
            - heading "1 Your details" [level=2] [ref=e23]:
              - generic [ref=e24]: "1"
              - text: Your details
            - paragraph [ref=e25]: We create your account from these details, so you can read and listen straight after paying.
            - generic [ref=e26]:
              - generic [ref=e27]:
                - text: First name
                - textbox "First name" [ref=e28]: Ada
              - generic [ref=e29]:
                - text: Last name
                - textbox "Last name" [ref=e30]: Tester
              - generic [ref=e31]:
                - text: Email
                - textbox "Email" [ref=e32]: e2e-5edu2xuk@example.test
              - generic [ref=e33]:
                - text: Phone number
                - generic [ref=e35]:
                  - combobox "Country code" [ref=e36]:
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
                  - generic [ref=e37]:
                    - generic [ref=e38]: Phone number
                    - textbox "Phone number" [ref=e39]:
                      - /placeholder: 712 345 678
                      - text: "760756178"
            - paragraph [ref=e40]: "Already have an account with this email? Just pay: the book is added to it, then sign in with a code."
          - region [ref=e41]:
            - heading "2 Payment method" [level=2] [ref=e42]:
              - generic [ref=e43]: "2"
              - text: Payment method
            - radiogroup "Payment method" [ref=e44]:
              - generic [ref=e45] [cursor=pointer]:
                - radio "Card Visa or Mastercard, secured by Paystack" [checked] [ref=e46]
                - text: Card
                - generic [ref=e47]: Visa or Mastercard, secured by Paystack
        - complementary [ref=e48]:
          - heading "Order summary" [level=2] [ref=e49]
          - list [ref=e50]:
            - listitem [ref=e51]:
              - generic [ref=e52]: Test Media Book
              - generic [ref=e53]: KES 50
          - generic [ref=e54]:
            - textbox "Coupon code" [ref=e55]: FREE100
            - button "Apply" [ref=e56]
          - generic [ref=e57]:
            - generic [ref=e58]:
              - term [ref=e59]: Subtotal
              - definition [ref=e60]: KES 50
            - generic [ref=e61]:
              - term [ref=e62]: Discount (FREE100)
              - definition [ref=e63]: "- KES 50"
            - generic [ref=e64]:
              - term [ref=e65]: Fees
              - definition [ref=e66]: KES 0
            - generic [ref=e67]:
              - term [ref=e68]: Total
              - definition [ref=e69]: KES 0
          - alert [ref=e70]: Please complete the security check.
          - button "Get my book" [active] [ref=e71]
          - paragraph [ref=e72]: You are only charged once the payment provider confirms it.
  - contentinfo [ref=e73]:
    - generic [ref=e74]:
      - generic [ref=e75]:
        - generic [ref=e76]:
          - generic [ref=e77]:
            - generic [ref=e78]: ♥
            - generic [ref=e79]: Wangeci
          - paragraph [ref=e80]: Author, entrepreneur and former journalist Wangeci Kariuki—turning pieces into power, one story at a time.
        - generic [ref=e81]:
          - heading "Explore" [level=4] [ref=e82]
          - list [ref=e83]:
            - listitem [ref=e84]:
              - link "Home" [ref=e85] [cursor=pointer]:
                - /url: /
            - listitem [ref=e86]:
              - link "About Me" [ref=e87] [cursor=pointer]:
                - /url: /about
            - listitem [ref=e88]:
              - link "Store" [ref=e89] [cursor=pointer]:
                - /url: /store
            - listitem [ref=e90]:
              - link "Services" [ref=e91] [cursor=pointer]:
                - /url: /services
        - generic [ref=e92]:
          - heading "Her Ventures" [level=4] [ref=e93]
          - list [ref=e94]:
            - listitem [ref=e95]: Fechi Organics
            - listitem [ref=e96]: Blissful Oasis
            - listitem [ref=e97]: Home Care Solutions
        - generic [ref=e98]:
          - heading "Contact Us" [level=4] [ref=e99]
          - list [ref=e100]:
            - listitem [ref=e101]:
              - generic [ref=e102]: TODO(client)
            - listitem [ref=e103]:
              - generic [ref=e104]: TODO(client)
            - listitem [ref=e105]:
              - generic [ref=e106]: TODO(client)
      - separator [ref=e107]
      - generic [ref=e108]:
        - generic:
          - generic "Facebook"
          - generic "Instagram"
          - generic "YouTube"
          - generic "TikTok"
          - generic "LinkedIn"
        - generic [ref=e109]:
          - text: Powered by
          - link "Kyfaru Kyfaru" [ref=e110] [cursor=pointer]:
            - /url: https://kyfaru.com
            - img "Kyfaru" [ref=e112]
            - generic [ref=e113]: Kyfaru
        - navigation "Legal" [ref=e114]:
          - link "Contact" [ref=e115] [cursor=pointer]:
            - /url: /contact
          - link "Terms" [ref=e116] [cursor=pointer]:
            - /url: /terms
          - link "Privacy" [ref=e117] [cursor=pointer]:
            - /url: /privacy
          - link "Refunds" [ref=e118] [cursor=pointer]:
            - /url: /refunds
          - link "Cookies" [ref=e119] [cursor=pointer]:
            - /url: /cookies
        - paragraph [ref=e120]: © 2026 Wangeci Kariuki. All rights reserved.
    - img [ref=e122] [cursor=pointer]:
      - generic [ref=e123]: Wangeci
      - generic [ref=e124]: Wangeci
      - generic [ref=e125]: Wangeci
  - button "Open Next.js Dev Tools" [ref=e132] [cursor=pointer]:
    - generic [ref=e135]:
      - text: Compiling
      - generic [ref=e136]:
        - generic [ref=e137]: .
        - generic [ref=e138]: .
        - generic [ref=e139]: .
  - alert [ref=e140]
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
> 84  |     const response = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/checkout" && r.request().method() === "POST");
      |                           ^ Error: page.waitForResponse: Test timeout of 120000ms exceeded.
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
```