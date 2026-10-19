import { createHmac, createHash } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { db, e2eEmail, uid } from "./db";

/**
 * Book authoring, end to end: the owner signs in (email code + authenticator code), writes and publishes a book in
 * the browser, and a buyer reads it. Audio upload needs a real R2 bucket, so it is skipped (see the last test).
 *
 * Sign-in codes are stored hashed by Better Auth, so after the app "sends" one the test overwrites the stored
 * hash with the hash of a code it knows. That is the same value the app would have printed in the dev console.
 */

const KNOWN_CODE = "4242"; // OTP_LENGTH in lib/auth/constants.ts is 4
const hashed = (otp: string) => createHash("sha256").update(otp).digest("base64url");

async function useKnownCode(type: "sign-in" | "email-verification", email: string) {
  const identifier = `${type}-otp-${email}`;
  await expect
    .poll(async () => (await db().verification.updateMany({ where: { identifier }, data: { value: `${hashed(KNOWN_CODE)}:0` } })).count, { timeout: 60_000 })
    .toBeGreaterThan(0);
}

async function typeCode(page: Page, code: string) {
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(code, { delay: 40 });
}

/** RFC 6238 (SHA-1, 6 digits, 30 s), what every authenticator app does. */
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of input.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string, at = Date.now()): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const h = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** Signs in through the real sign-in page with an email code. Returns after the redirect away from /verify. */
async function signInByEmailCode(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page).toHaveURL(/\/verify/);
  await useKnownCode("sign-in", email);
  await typeCode(page, KNOWN_CODE);
  await expect(page).not.toHaveURL(/\/verify/, { timeout: 60_000 });
}

const created = { slugs: [] as string[], emails: [] as string[] };

test.describe("book authoring", () => {
  test.describe.configure({ mode: "serial" });

  const ownerEmail = e2eEmail();
  const readerEmail = e2eEmail();
  const slug = `e2e-book-${uid()}`;
  const title = `E2E Authored Book ${uid()}`;
  let editionId = "";
  let readerId = "";

  test.beforeAll(() => {
    created.slugs.push(slug);
    created.emails.push(ownerEmail, readerEmail);
  });

  test.afterAll(async () => {
    const prisma = db();
    const users = await prisma.user.findMany({ where: { email: { in: created.emails } }, select: { id: true } });
    const userIds = users.map((u) => u.id);
    const works = await prisma.work.findMany({ where: { slug: { in: created.slugs } }, select: { id: true, editions: { select: { id: true } } } });
    const editionIds = works.flatMap((w) => w.editions.map((e) => e.id));
    const steps = [
      () => prisma.readingPosition.deleteMany({ where: { editionId: { in: editionIds } } }),
      () => prisma.bookmark.deleteMany({ where: { editionId: { in: editionIds } } }),
      () => prisma.entitlement.deleteMany({ where: { OR: [{ editionId: { in: editionIds } }, { userId: { in: userIds } }] } }),
      () => prisma.chapter.deleteMany({ where: { editionId: { in: editionIds } } }),
      () => prisma.edition.deleteMany({ where: { id: { in: editionIds } } }),
      () => prisma.work.deleteMany({ where: { id: { in: works.map((w) => w.id) } } }),
      () => prisma.auditLog.deleteMany({ where: { adminId: { in: userIds } } }),
      () => prisma.verification.deleteMany({ where: { OR: created.emails.map((e) => ({ identifier: { endsWith: e } })) } }),
      () => prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ];
    for (const step of steps) await step().catch((e: Error) => console.warn(`[e2e] authoring cleanup step skipped: ${e.message.split("\n").pop()}`));
  });

  test("should sign the owner in with an email code and set up the authenticator app", async ({ page }) => {
    // Arrange: an owner account (the allowlist only bootstraps the very first owner, so the test makes its own)
    await db().user.create({ data: { name: "E2E Owner", email: ownerEmail, emailVerified: true, role: "owner" } });

    // Act
    await signInByEmailCode(page, ownerEmail);
    await page.goto("/dashboard/settings");
    // A code proved a moment ago counts as a fresh proof, so the confirm panel only appears when that has lapsed.
    const key = page.locator("code").first();
    const confirm = page.getByRole("button", { name: "Email me a code" });
    // A click before the page has hydrated does nothing, so click again until the set-up (or the confirm panel) appears.
    await expect(async () => {
      if (!(await key.or(confirm).isVisible())) await page.getByRole("button", { name: "Set up" }).click({ timeout: 3_000 });
      await expect(key.or(confirm)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 90_000 });
    if (await confirm.isVisible()) {
      await confirm.click();
      await useKnownCode("email-verification", ownerEmail);
      await typeCode(page, KNOWN_CODE); // proving the mailbox retries the set-up automatically
    }

    // Assert
    await expect(key).toBeVisible({ timeout: 30_000 });
    await typeCode(page, totp((await key.innerText()).trim()));
    await expect(page.getByText("Two-step check is on.")).toBeVisible({ timeout: 30_000 });
    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible({ timeout: 60_000 });

    // The context's cookies are the owner's session; keep them for the rest of the serial run.
    await page.context().storageState({ path: "test-results/e2e-owner-state.json" });
  });

  test.describe("signed in as the owner", () => {
    test.use({ storageState: "test-results/e2e-owner-state.json" });

    test("should create a new ebook draft from the New book form", async ({ page }) => {
      await page.goto("/admin/content");
      await page.getByText("New book", { exact: true }).click();
      await page.getByLabel("Title", { exact: true }).fill(title);
      await page.getByLabel("Web address (slug)").fill(slug);
      await page.getByLabel("Author", { exact: true }).fill("E2E Author");
      await page.getByLabel("Price", { exact: true }).fill("100");
      await page.getByLabel("Description").fill("A book written by the end-to-end suite.");
      await page.getByRole("button", { name: "Create book" }).click();

      await expect(page.getByText("Book created as a draft")).toBeVisible();
      const edition = await db().edition.findFirstOrThrow({ where: { work: { slug } }, include: { work: true } });
      editionId = edition.id;
      expect(edition.isActive).toBe(false);
      expect(edition.format).toBe("EPUB");
      expect(Number(edition.price)).toBe(100);
      expect(edition.work.title).toBe(title);
    });

    test("should list blocking issues on the chapters page of an empty draft", async ({ page }) => {
      await page.goto("/admin/content");
      await page.locator("section", { hasText: title }).getByRole("link", { name: "Manage chapters" }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/content/${editionId}`));

      await expect(page.getByText("Blocking: Add at least one chapter.")).toBeVisible();
      await expect(page.getByText("No chapters yet.")).toBeVisible();
    });

    test("should import two chapters from a pasted manuscript and show their word counts", async ({ page }) => {
      await page.goto(`/admin/content/${editionId}`);
      await page.getByText("Paste whole manuscript").click();
      await page.getByLabel("Manuscript").fill(
        "## The First Step\n\nAlpha beta gamma delta epsilon.\n\nZeta eta theta iota kappa lambda.\n\n## The Second Step\n\nMu nu xi omicron pi rho sigma tau.\n",
      );
      await expect(page.getByText("The First Step (11 words)")).toBeVisible(); // the live preview before submitting
      await expect(page.getByText("The Second Step (8 words)")).toBeVisible();
      await page.getByRole("button", { name: "Import 2 chapters" }).click();

      await expect(page.getByText("2 chapters added.")).toBeVisible();
      const rows = page.getByRole("table", { name: "Chapters" }).getByRole("row");
      await expect(rows.filter({ hasText: "The First Step" })).toContainText("11");
      await expect(rows.filter({ hasText: "The Second Step" })).toContainText("8");
      await expect(page.getByText("Blocking: Add at least one chapter.")).toHaveCount(0);
    });

    test("should mark chapter 1 as a free preview", async ({ page }) => {
      await page.goto(`/admin/content/${editionId}`);
      await expect(page.getByText("Warning: No chapter is marked as a free preview")).toBeVisible();
      await page.getByRole("row").filter({ hasText: "The First Step" }).getByRole("link", { name: "Edit" }).click();
      await expect(page.getByRole("heading", { name: "Edit: The First Step" })).toBeVisible();
      await expect(page.getByLabel("Title", { exact: true })).toHaveValue("The First Step");
      await page.getByLabel("Free preview chapter").check();
      await page.getByRole("button", { name: "Save chapter" }).click();

      await expect(page.getByText("Chapter saved.")).toBeVisible();
      await expect.poll(async () => (await db().chapter.findFirstOrThrow({ where: { editionId, idx: 0 } })).isFreePreview).toBe(true);
      await expect(page.getByRole("row").filter({ hasText: "The First Step" })).toContainText("Yes");
      const chapter = await db().chapter.findFirstOrThrow({ where: { editionId, idx: 0 } });
      expect(chapter.body).toContain("Alpha beta gamma delta epsilon.");
    });

    test("should preview the draft in the reader and keep the preview flag on the next chapter", async ({ page }) => {
      await page.goto(`/admin/content/${editionId}`);
      await page.getByRole("link", { name: "Preview in reader" }).click();

      await expect(page).toHaveURL(new RegExp(`preview=${editionId}`), { timeout: 90_000 }); // the reader route compiles on first use
      await expect(page.getByText("Preview, nothing is saved")).toBeVisible({ timeout: 60_000 });
      await expect(page.getByText("Alpha beta gamma delta epsilon.")).toBeVisible();

      await page.getByRole("button", { name: "Next >" }).click();
      await expect(page).toHaveURL(new RegExp(`idx=1&preview=${editionId}`));
      await expect(page.getByText("Mu nu xi omicron pi rho sigma tau.")).toBeVisible();
    });

    test("should publish the book so it shows on the store", async ({ page, request }) => {
      await page.goto(`/admin/content/${editionId}`);
      await expect(page.getByText("Ready to publish", { exact: true })).toBeVisible();
      const ready = page.locator("section[aria-labelledby=ready]");
      await ready.getByLabel("Reason (kept in the audit log)").fill("Publishing from the e2e suite");
      await ready.getByRole("button", { name: "Publish", exact: true }).click();
      await expect(page.getByText("Edition published.")).toBeVisible();
      expect((await db().edition.findUniqueOrThrow({ where: { id: editionId } })).isActive).toBe(true);

      await page.goto("/store");
      await expect(page.getByRole("heading", { name: title })).toBeVisible();
      await page.goto(`/store/${slug}`);
      await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();

      // The landing page's "Get My Book" button still leads somewhere real.
      await page.goto("/");
      const href = await page.getByRole("link", { name: /Get My Book/i }).first().getAttribute("href");
      expect(href).toBeTruthy();
      expect((await request.get(href!)).status()).toBeLessThan(400);
    });
  });

  test("should let a buyer with an entitlement read chapter text in the reader", async ({ browser }) => {
    // Arrange: a reader who owns the book (the payment path is covered by app.spec.ts)
    const reader = await db().user.create({ data: { name: "E2E Reader", email: readerEmail, emailVerified: true } });
    readerId = reader.id;
    await db().entitlement.create({ data: { userId: reader.id, editionId } });

    // Act
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInByEmailCode(page, readerEmail);
    await page.goto(`/dashboard/books/${slug}/read`);

    // Assert
    await expect(page.getByText("Alpha beta gamma delta epsilon.")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Preview, nothing is saved")).toHaveCount(0);
    await context.close();
  });

  test.describe("refusals", () => {
    test.use({ storageState: "test-results/e2e-owner-state.json" });

    test("should refuse to move a chapter once a reader has a saved place", async ({ page }) => {
      // Arrange: a draft with two chapters; the chapters page is opened while it is still movable
      const lockSlug = `e2e-lock-${uid()}`;
      created.slugs.push(lockSlug);
      const work = await db().work.create({ data: { slug: lockSlug, title: "E2E Lock Book", author: "E2E Author" } });
      const edition = await db().edition.create({ data: { workId: work.id, format: "EPUB", price: 100, isActive: false } });
      await db().chapter.createMany({
        data: [
          { editionId: edition.id, idx: 0, title: "Lock One", body: "One two three.", wordCount: 3 },
          { editionId: edition.id, idx: 1, title: "Lock Two", body: "Four five six.", wordCount: 3 },
        ],
      });
      await page.goto(`/admin/content/${edition.id}`);
      const down = page.getByRole("row").filter({ hasText: "Lock One" }).getByRole("button", { name: "Down" });
      await expect(down).toBeVisible();

      // Act: a reader saves a place after the page loaded, then the owner clicks the (now stale) button
      await db().readingPosition.create({ data: { userId: readerId, editionId: edition.id, locator: "0:1", progressPct: 10 } });
      await down.click();

      // Assert: the server refuses and the order is unchanged
      await expect(page.getByText("Readers already have a place saved in this book")).toBeVisible();
      expect((await db().chapter.findFirstOrThrow({ where: { editionId: edition.id, title: "Lock One" } })).idx).toBe(0);
      await page.reload();
      await expect(page.getByText("Moving chapters is switched off")).toBeVisible();
      await expect(page.getByRole("button", { name: "Down" })).toHaveCount(0);
    });

    test("should refuse to publish an edition that has an empty chapter", async ({ page }) => {
      const emptySlug = `e2e-empty-${uid()}`;
      created.slugs.push(emptySlug);
      const work = await db().work.create({ data: { slug: emptySlug, title: "E2E Empty Chapter Book", author: "E2E Author" } });
      const edition = await db().edition.create({ data: { workId: work.id, format: "EPUB", price: 100, isActive: false } });
      await db().chapter.create({ data: { editionId: edition.id, idx: 0, title: "Hollow", body: "", wordCount: 0 } });

      await page.goto(`/admin/content/${edition.id}`);
      await expect(page.getByText("Blocking: Chapter 1 (Hollow) has no text.")).toBeVisible();
      const ready = page.locator("section[aria-labelledby=ready]");
      await ready.getByLabel("Reason (kept in the audit log)").fill("Trying to publish an empty chapter");
      await ready.getByRole("button", { name: "Publish", exact: true }).click();

      await expect(page.getByText("This edition is not ready to publish.")).toBeVisible();
      expect((await db().edition.findUniqueOrThrow({ where: { id: edition.id } })).isActive).toBe(false);
    });
  });

  test.skip("chapter audio upload (needs a real R2 bucket and a browser upload to it; run by hand with R2 keys)", () => {});
});

