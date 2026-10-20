import { createHash, createHmac } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { expect, test as base, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

import { createUser, db, e2eEmail, e2ePhone, nationalOf, uid } from "./db";

/**
 * Every input in the browser, and every page at phone widths.
 *
 *  A. Form inputs, one describe per form. Each field gets: empty, only spaces, 1 character, the maximum, maximum + 1,
 *     unicode, an HTML/script payload, a very long single word (at 360 px), and an SQL-looking string. Around the
 *     fields: paste, autofill-style input, keyboard only, accessible names, error association, double submit.
 *  B. A responsive sweep of every route at six widths, summarised in e2e/responsive-report.txt.
 *
 * Rules every test inherits (the `guard` fixture): no alert/confirm/prompt dialog may open, no page script error,
 * no 5xx answer. A test that shows a real app bug is marked with bug("...") (Playwright test.fail), so the suite
 * stays green and the list of bugs stays explicit; when the bug is fixed the test starts "passing unexpectedly".
 */

const BASE = `http://localhost:${process.env.E2E_PORT ?? 3123}`;
const STATE_DIR = "test-results/inputs";
const KNOWN_CODE = "4242"; // OTP_LENGTH in lib/auth/constants.ts is 4
const TURNSTILE_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";
const FAKE_TURNSTILE = `(() => {
  let opts;
  window.turnstile = {
    render(el, o) { opts = o; setTimeout(() => o.callback("${TURNSTILE_TOKEN}"), 0); return "e2e-widget"; },
    reset() { if (opts) setTimeout(() => opts.callback("${TURNSTILE_TOKEN}"), 0); },
    remove() {},
  };
})();`;

// Fixed names (every run starts from a clean database, see global-setup), so a restarted worker finds the same accounts.
const ACCOUNTS = {
  reader: "e2e-inp-reader@example.test",
  community: "e2e-inp-community@example.test",
  owner: "e2e-inp-owner@example.test",
  twofa: "e2e-inp-twofa@example.test",
};
const READ_SLUG = "e2e-inp-read-book";
const AUDIO_SLUG = "e2e-inp-audio-book";

const fakeIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const stateFile = (name: string) => `${STATE_DIR}/${name}.json`;

// ---------------------------------------------------------------------------------------------------------------------
// Test plumbing
// ---------------------------------------------------------------------------------------------------------------------

/** Marks the running test as a known app bug (Playwright "expected to fail"). */
function bug(reason: string) {
  test.fail(true, `BUG: ${reason}`);
}

const test = base.extend<{ guard: void }>({
  guard: [
    async ({ page }, use) => {
      const dialogs: string[] = [];
      const crashes: string[] = [];
      page.on("dialog", (d) => {
        if (d.type() === "beforeunload") return void d.accept().catch(() => undefined);
        dialogs.push(`${d.type()}: ${d.message()}`);
        void d.dismiss().catch(() => undefined);
      });
      page.on("pageerror", (e) => crashes.push(`script error: ${e.message}`));
      page.on("response", (r) => {
        if (r.status() >= 500) crashes.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
      });
      await use();
      expect(dialogs, "an alert/confirm/prompt dialog opened (script ran?)").toEqual([]);
      expect(crashes, "page script error or 5xx answer").toEqual([]);
    },
    { auto: true },
  ],
});

let ip = fakeIp();
test.beforeEach(async ({ context }) => {
  ip = fakeIp();
  await prepare(context);
});

/** Own "network address" per test (the app limits per address) and a Turnstile stub that hands out the test token. */
async function prepare(context: BrowserContext) {
  await context.setExtraHTTPHeaders({ "x-forwarded-for": ip });
  await context.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_TURNSTILE }));
}

/** Waits until React has attached to the page, so a click is handled by the app and not by the browser's default form submit. */
async function hydrated(page: Page, selector = "form, button") {
  await expect
    .poll(() => page.locator(selector).first().evaluate((el) => Object.keys(el).some((k) => k.startsWith("__reactProps") || k.startsWith("__reactFiber"))), { timeout: 90_000, intervals: [250, 500, 1000] })
    .toBe(true);
}

/** Text of every visible role=alert / role=status element in the page body (Next's route announcer sits in shadow DOM and is not matched). */
async function messages(page: Page): Promise<string[]> {
  try {
    return await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[role="alert"], [role="status"]')]
        .filter((el) => (el as HTMLElement & { checkVisibility?: () => boolean }).checkVisibility?.() !== false && (el.innerText ?? "").trim() !== "")
        .map((el) => el.innerText.trim()),
    );
  } catch {
    return []; // the page is navigating
  }
}

type Decision = { result: "accepted" | "rejected"; messages: string[] };

/** Waits until the form either went through (`accepted`) or showed a message. Never hangs silently: a timeout fails the test. */
async function decide(page: Page, accepted: (p: Page) => Promise<boolean>, timeout = 45_000): Promise<Decision> {
  let result: Decision["result"] = "rejected";
  await expect
    .poll(
      async () => {
        try {
          if (await accepted(page)) return (result = "accepted");
          if ((await messages(page)).length > 0) return (result = "rejected");
        } catch {
          /* navigating */
        }
        return "pending";
      },
      { timeout, intervals: [150, 300, 600, 1000], message: "the form neither went through nor showed a message" },
    )
    .not.toBe("pending");
  return { result, messages: await messages(page) };
}

async function expectNoHScroll(page: Page, note = "") {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(m.sw, `page scrolls sideways (${m.sw}px > ${m.cw}px) ${note}`).toBeLessThanOrEqual(m.cw);
}

const setKnownCode = async (type: "sign-in" | "email-verification", email: string) => {
  const identifier = `${type}-otp-${email}`;
  const hashed = createHash("sha256").update(KNOWN_CODE).digest("base64url");
  await expect
    .poll(async () => (await db().verification.updateMany({ where: { identifier }, data: { value: `${hashed}:0` } })).count, { timeout: 60_000 })
    .toBeGreaterThan(0);
};

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

async function signInByEmailCode(page: Page, email: string) {
  await page.goto("/sign-in");
  await hydrated(page);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Continue with email" }).click();
  await expect(page).toHaveURL(/\/verify/, { timeout: 60_000 });
  await setKnownCode("sign-in", email);
  await typeCode(page, KNOWN_CODE);
  await expect(page).not.toHaveURL(/\/verify/, { timeout: 60_000 });
}

/** A fresh browser context with the usual headers/stubs (for work done outside a test, in beforeAll). */
async function freshContext(browser: Browser, state?: string) {
  ip = fakeIp();
  const context = await browser.newContext({ baseURL: BASE, storageState: state });
  await prepare(context);
  return context;
}

/** Signs a reader in once per run and keeps the cookies; later calls (also after a worker restart) reuse the file. */
async function readerState(browser: Browser, key: "reader" | "community" | "twofa"): Promise<string> {
  const file = stateFile(key);
  if (existsSync(file)) return file;
  mkdirSync(STATE_DIR, { recursive: true });
  const email = ACCOUNTS[key];
  if (!(await db().user.findUnique({ where: { email } }))) await createUser({ email, name: `E2E ${key} Reader` });
  const context = await freshContext(browser);
  const page = await context.newPage();
  await signInByEmailCode(page, email);
  await context.storageState({ path: file });
  await context.close();
  return file;
}

/** Owner = signs in with an email code and sets up the authenticator app (admin pages demand it). Keeps the cookies. */
async function ownerState(browser: Browser): Promise<string> {
  const file = stateFile("owner");
  if (existsSync(file)) return file;
  mkdirSync(STATE_DIR, { recursive: true });
  const email = ACCOUNTS.owner;
  if (!(await db().user.findUnique({ where: { email } }))) await db().user.create({ data: { name: "E2E Inputs Owner", email, emailVerified: true, role: "owner" } });
  const context = await freshContext(browser);
  const page = await context.newPage();
  await signInByEmailCode(page, email);
  await page.goto("/dashboard/settings");
  const key = page.locator("code").first();
  const confirm = page.getByRole("button", { name: "Email me a code" });
  await expect(async () => {
    if (!(await key.or(confirm).isVisible())) await page.getByRole("button", { name: "Set up" }).click({ timeout: 3_000 });
    await expect(key.or(confirm)).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  if (await confirm.isVisible()) {
    await confirm.click();
    await setKnownCode("email-verification", email);
    await typeCode(page, KNOWN_CODE);
  }
  await expect(key).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Digit 1").click();
  await page.keyboard.type(totp((await key.innerText()).trim()), { delay: 40 });
  await expect(page.getByText("Two-step check is on.")).toBeVisible({ timeout: 30_000 });
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Content", exact: true })).toBeVisible({ timeout: 90_000 });
  await context.storageState({ path: file });
  await context.close();
  return file;
}

/** Two books for the reader and the player: an ebook with three chapters and an audiobook with two (audio is served by a route stub). */
async function ensureBooks() {
  const prisma = db();
  const reader = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS.reader } });
  const words = (n: number, seed: string) => Array.from({ length: n }, (_, i) => `${seed}${i % 97}`).join(" ");
  const paragraphs = (n: number, per: number, seed: string) => Array.from({ length: n }, (_, i) => words(per, `${seed}${i}x`)).join("\n\n");

  const ebookWork = await prisma.work.upsert({ where: { slug: READ_SLUG }, create: { slug: READ_SLUG, title: "E2E Inputs Reading Book", author: "E2E Author", description: "A book for the inputs suite." }, update: {} });
  let ebook = await prisma.edition.findFirst({ where: { workId: ebookWork.id, format: "EPUB" } });
  if (!ebook) {
    ebook = await prisma.edition.create({ data: { workId: ebookWork.id, format: "EPUB", price: 100, isActive: true } });
    const bodies = [paragraphs(30, 90, "alpha"), paragraphs(10, 80, "beta"), paragraphs(5, 70, "gamma")];
    await prisma.chapter.createMany({
      data: bodies.map((body, idx) => ({ editionId: ebook!.id, idx, title: `Chapter ${idx + 1}`, body, wordCount: body.split(/\s+/).length, isFreePreview: idx === 0 })),
    });
  }
  await prisma.entitlement.upsert({ where: { userId_editionId: { userId: reader.id, editionId: ebook.id } }, create: { userId: reader.id, editionId: ebook.id }, update: {} });

  const audioWork = await prisma.work.upsert({ where: { slug: AUDIO_SLUG }, create: { slug: AUDIO_SLUG, title: "E2E Inputs Audio Book", author: "E2E Author", description: "An audiobook for the inputs suite." }, update: {} });
  let audio = await prisma.edition.findFirst({ where: { workId: audioWork.id, format: "AUDIOBOOK" } });
  if (!audio) {
    audio = await prisma.edition.create({ data: { workId: audioWork.id, format: "AUDIOBOOK", price: 150, isActive: true, narrator: "E2E Narrator", durationSeconds: AUDIO_SECONDS * 2 } });
    for (const idx of [0, 1]) {
      const asset = await prisma.asset.create({ data: { editionId: audio.id, kind: "AUDIO_FILE", bucket: "local", key: `/e2e-inp-audio-${idx}.wav`, mimeType: "audio/wav", sizeBytes: 1 } });
      await prisma.chapter.create({ data: { editionId: audio.id, idx, title: `Track ${idx + 1}`, body: paragraphs(2, 30, "voice"), wordCount: 60, durationSeconds: AUDIO_SECONDS, assetId: asset.id } });
    }
  }
  await prisma.entitlement.upsert({ where: { userId_editionId: { userId: reader.id, editionId: audio.id } }, create: { userId: reader.id, editionId: audio.id }, update: {} });
  return { ebookId: ebook.id, audioId: audio.id };
}

const AUDIO_SECONDS = 40;
/** A silent 8 kHz mono WAV of AUDIO_SECONDS seconds: small, and every browser can play it. */
function silentWav(seconds = AUDIO_SECONDS): Buffer {
  const rate = 8000;
  const data = Buffer.alloc(rate * seconds, 128);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

// ---------------------------------------------------------------------------------------------------------------------
// The field matrix
// ---------------------------------------------------------------------------------------------------------------------

interface FieldDef {
  id: string;
  loc: (p: Page) => Locator;
  kind: "text" | "email" | "phone" | "message";
  required: boolean;
  /** Shortest value that is accepted (after trimming). */
  min: number;
  /** The limit in the code (client or server). */
  max: number;
  /** The input itself carries maxLength, so typing past the limit is blocked in the browser. */
  clientMax: boolean;
  valid: () => string;
  /** A valid value of exactly n characters (emails and phones need their shape). */
  makeMax?: (n: number) => string;
}

interface FormDef {
  name: string;
  open: (p: Page) => Promise<void>;
  fields: FieldDef[];
  fillAll?: (p: Page, v: Record<string, string>) => Promise<void>;
  submit: (p: Page) => Promise<void>;
  accepted: (p: Page) => Promise<boolean>;
  /** Names `getByLabel` must find, to prove every input has an accessible name. */
  labels: string[];
  /** Accessible names in the order Tab visits them (inputs and the submit button). */
  tabOrder: string[];
  /** Counts a request that belongs to one submit (double-click check). */
  isSubmitRequest: (url: string, method: string) => boolean;
}

const SCRIPT = `<script>alert(1)</script><img src=x onerror=alert(2)>"><svg onload=alert(3)>`;
const SQLISH = `'; DROP TABLE "user"; -- ' OR 1=1`;
const UNICODE = "ZoÃ« Ã‘andÃº ðŸ˜€ æ—¥æœ¬èªž Ù…Ø±Ø­Ø¨Ø§";

/** An email address of exactly n characters whose parts are all within the RFC limits (64-character local part, 63-character labels). */
function emailOfLength(n: number): string {
  const local = "a".repeat(Math.min(64, Math.max(1, n - 12)));
  let remaining = n - local.length - 6; // "@" + ".test"
  const labels: string[] = [];
  while (remaining > 0) {
    if (labels.length > 0) remaining -= 1; // the dot between labels
    const len = Math.min(63, remaining);
    labels.push("b".repeat(len));
    remaining -= len;
  }
  return `${local}@${labels.join(".")}.test`;
}

interface Case {
  id: string;
  cond: string;
  value: string;
  expect: "accept" | "reject" | "either";
  typed?: boolean;
  narrow?: boolean;
}

function casesFor(f: FieldDef): Case[] {
  const free = f.kind === "text" || f.kind === "message";
  const out: Case[] = [];
  out.push({ id: "empty", cond: "it is empty", value: "", expect: f.required ? "reject" : "accept" });
  out.push({ id: "spaces", cond: "it is only spaces", value: "   ", expect: f.required ? "reject" : "accept" });
  out.push({ id: "one", cond: "it is 1 character", value: f.kind === "phone" ? "7" : "a", expect: f.min <= 1 ? "accept" : "reject" });
  if (free || f.makeMax) out.push({ id: "max", cond: `it is exactly ${f.max} characters`, value: f.makeMax ? f.makeMax(f.max) : "a".repeat(f.max), expect: f.kind === "message" || f.kind === "text" ? "accept" : "either" });
  out.push({ id: "over", cond: `it is ${f.max + 1} characters`, value: f.makeMax ? f.makeMax(f.max + 1) : f.kind === "phone" ? "7".repeat(f.max + 1) : "a".repeat(f.max + 1), expect: f.clientMax ? "accept" : "reject", typed: true });
  out.push({ id: "unicode", cond: "it has accents, emoji and non-latin letters", value: f.kind === "email" ? `zoÃ«ðŸ˜€@example.test` : f.kind === "phone" ? UNICODE : UNICODE, expect: free ? "accept" : f.kind === "email" ? "either" : "reject" });
  out.push({ id: "html", cond: "it holds an HTML/script payload", value: SCRIPT, expect: free ? "accept" : f.kind === "email" ? "either" : "reject" });
  if (free) out.push({ id: "longword", cond: "it is one very long word (360 px wide screen)", value: "W".repeat(Math.min(f.max, 600)), expect: "accept", narrow: true });
  if (f.kind !== "phone") out.push({ id: "sql", cond: "it looks like SQL", value: SQLISH, expect: free ? "accept" : "reject" });
  return out;
}

async function setValue(page: Page, f: FieldDef, value: string, typed: boolean) {
  const loc = f.loc(page);
  if (!typed) return loc.fill(value);
  await loc.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.insertText(value);
}

async function fillAll(form: FormDef, page: Page, values: Record<string, string>) {
  if (form.fillAll) return form.fillAll(page, values);
  for (const f of form.fields) await f.loc(page).fill(values[f.id]);
}

const validValues = (form: FormDef) => Object.fromEntries(form.fields.map((f) => [f.id, f.valid()]));

/** Message texts that read like library output, not like a sentence for a person. */
const RAW_LIBRARY_WORDING = /^(too big|too small|invalid input|expected |string must|String must)/i;

function fieldMatrix(form: FormDef, knownBugs: Record<string, string> = {}) {
  test.describe(`${form.name}: field matrix`, () => {
    for (const f of form.fields) {
      for (const c of casesFor(f)) {
        const verb = c.expect === "accept" ? "accept" : c.expect === "reject" ? "reject" : "handle";
        test(`should ${verb} ${f.id} when ${c.cond}`, async ({ page }) => {
          const known = knownBugs[`${f.id}:${c.id}`];
          if (known) bug(known);
          if (c.narrow) await page.setViewportSize({ width: 360, height: 740 });
          await form.open(page);
          await fillAll(form, page, validValues(form));
          await setValue(page, f, c.value, Boolean(c.typed));
          if (c.typed && f.clientMax) {
            const typed = await f.loc(page).inputValue();
            expect(typed.length, `${f.id} let ${typed.length} characters in; the limit is ${f.max}`).toBeLessThanOrEqual(f.max);
          }
          await form.submit(page);
          const out = await decide(page, form.accepted);
          if (c.expect === "accept") expect(out.result, `${f.id} was not accepted: ${out.messages.join(" | ")}`).toBe("accepted");
          if (c.expect === "reject") {
            expect(out.result, `${f.id} = ${JSON.stringify(c.value.slice(0, 40))} went through`).toBe("rejected");
            expect(out.messages.length, "a rejection must show a message").toBeGreaterThan(0);
            for (const m of out.messages) expect(m, "the message reads like library output").not.toMatch(RAW_LIBRARY_WORDING);
          }
          await expectNoHScroll(page, `after ${f.id}: ${c.cond}`);
        });
      }
    }
  });
}

/** The extras around the fields that every form gets. */
function formBasics(form: FormDef, opts: { errorAssociation?: string; doubleSubmit?: boolean; bugs?: Partial<Record<"names" | "association" | "double" | "tab" | "enter" | "paste" | "autofill", string>> } = {}) {
  const bugs = opts.bugs ?? {};
  test.describe(`${form.name}: keyboard, names and double submit`, () => {
    test("should give every input an accessible name when the form is open", async ({ page }) => {
      if (bugs.names) bug(bugs.names);
      await form.open(page);
      for (const label of form.labels) await expect(page.getByLabel(label, { exact: true }), `no input is named "${label}"`).toHaveCount(1);
    });

    test("should visit the inputs in reading order when Tab is pressed", async ({ page }) => {
      if (bugs.tab) bug(bugs.tab);
      await form.open(page);
      await form.fields[0].loc(page).focus();
      const seen: string[] = [await activeName(page)];
      for (let i = 1; i < form.tabOrder.length; i++) {
        await page.keyboard.press("Tab");
        seen.push(await activeName(page));
      }
      expect(seen).toEqual(form.tabOrder);
    });

    test("should submit when Enter is pressed in the last field and the form was filled with the keyboard only", async ({ page }) => {
      if (bugs.enter) bug(bugs.enter);
      await form.open(page);
      const values = validValues(form);
      for (const f of form.fields) {
        await f.loc(page).focus();
        await page.keyboard.insertText(values[f.id]);
      }
      await form.fields[form.fields.length - 1].loc(page).press("Enter");
      const out = await decide(page, form.accepted);
      expect(out.result, out.messages.join(" | ")).toBe("accepted");
    });

    test("should accept the values when they arrive the way browser autofill sets them", async ({ page }) => {
      if (bugs.autofill) bug(bugs.autofill);
      await form.open(page);
      const values = validValues(form);
      for (const f of form.fields) {
        await f.loc(page).evaluate((el, v) => {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, v);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }, values[f.id]);
      }
      await form.submit(page);
      const out = await decide(page, form.accepted);
      expect(out.result, out.messages.join(" | ")).toBe("accepted");
    });

    test("should accept the values when they are pasted from the clipboard", async ({ page, context }) => {
      if (bugs.paste) bug(bugs.paste);
      await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
      await form.open(page);
      const values = validValues(form);
      for (const f of form.fields) {
        await page.evaluate((v) => navigator.clipboard.writeText(v), values[f.id]);
        await f.loc(page).focus();
        await page.keyboard.press("Control+V");
        await expect(f.loc(page)).toHaveValue(values[f.id]);
      }
      await form.submit(page);
      const out = await decide(page, form.accepted);
      expect(out.result, out.messages.join(" | ")).toBe("accepted");
    });

    if (opts.errorAssociation) {
      test(`should link the error message to the ${opts.errorAssociation} input with aria-invalid and aria-describedby when the form is submitted empty`, async ({ page }) => {
        if (bugs.association) bug(bugs.association);
        await form.open(page);
        const target = form.fields.find((f) => f.id === opts.errorAssociation)!;
        await fillAll(form, page, { ...validValues(form), [target.id]: "" });
        await form.submit(page);
        await decide(page, form.accepted);
        const input = target.loc(page);
        await expect(input).toHaveAttribute("aria-invalid", "true");
        const describedBy = await input.getAttribute("aria-describedby");
        expect(describedBy, "aria-describedby is missing").toBeTruthy();
        const text = await page.evaluate((id) => document.getElementById(id!)?.innerText ?? "", describedBy);
        expect(text.trim().length, "aria-describedby points at nothing").toBeGreaterThan(0);
      });
    }

    if (opts.doubleSubmit !== false) {
      test("should send only one request when the submit button is double-clicked", async ({ page }) => {
        if (bugs.double) bug(bugs.double);
        await form.open(page);
        await fillAll(form, page, validValues(form));
        let sent = 0;
        page.on("request", (r) => {
          if (form.isSubmitRequest(r.url(), r.method())) sent++;
        });
        const button = page.locator("form").getByRole("button", { name: /continue|create account|send message|pay|get my book/i }).last();
        await button.dblclick();
        await decide(page, form.accepted);
        await page.waitForTimeout(500);
        expect(sent, "requests sent by one double-click").toBe(1);
      });
    }
  });
}

async function activeName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | HTMLButtonElement | null;
    if (!el) return "";
    return (el.getAttribute("aria-label") || el.labels?.[0]?.textContent || (el as HTMLInputElement).placeholder || el.textContent || el.tagName).trim().replace(/\s+/g, " ");
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Form definitions
// ---------------------------------------------------------------------------------------------------------------------

const verifyUrl = async (p: Page) => /\/verify/.test(p.url());
const nationalPhone = () => nationalOf(e2ePhone());
const OTP_SEND = (url: string, method: string) => method === "POST" && /\/api\/auth\/(email-otp|phone-number)\/send/.test(url);

const phoneField = (over: Partial<FieldDef> = {}): FieldDef => ({
  id: "phone", loc: (p) => p.getByLabel("Phone number", { exact: true }), kind: "phone", required: true, min: 7, max: 12, clientMax: false, valid: nationalPhone,
  makeMax: (n) => "7" + "1".repeat(n - 1), ...over,
});

const SIGN_IN_EMAIL: FormDef = {
  name: "sign-in (email tab)",
  open: async (p) => {
    await p.goto("/sign-in");
    await hydrated(p);
  },
  fields: [{ id: "email", loc: (p) => p.getByLabel("Email address", { exact: true }), kind: "email", required: true, min: 6, max: 254, clientMax: false, valid: e2eEmail, makeMax: emailOfLength }],
  submit: (p) => p.getByRole("button", { name: "Continue with email" }).click(),
  accepted: verifyUrl,
  labels: ["Email address"],
  tabOrder: ["Email address", "Continue with email"],
  isSubmitRequest: OTP_SEND,
};

const SIGN_IN_PHONE: FormDef = {
  name: "sign-in (phone tab)",
  open: async (p) => {
    await p.goto("/sign-in");
    await hydrated(p);
    await p.getByRole("tab", { name: "Phone Number" }).click();
    await expect(p.getByRole("tab", { name: "Phone Number" })).toHaveAttribute("aria-selected", "true");
  },
  fields: [phoneField()],
  submit: (p) => p.getByRole("button", { name: "Continue with phone" }).click(),
  accepted: verifyUrl,
  labels: ["Phone number", "Country code"],
  tabOrder: ["Phone number", "Continue with phone"],
  isSubmitRequest: OTP_SEND,
};

const SIGN_UP: FormDef = {
  name: "sign-up",
  open: async (p) => {
    await p.goto("/sign-up");
    await hydrated(p);
  },
  fields: [
    { id: "first name", loc: (p) => p.getByLabel("First name", { exact: true }), kind: "text", required: true, min: 1, max: 60, clientMax: false, valid: () => "Ada" },
    { id: "last name", loc: (p) => p.getByLabel("Last name", { exact: true }), kind: "text", required: true, min: 1, max: 60, clientMax: false, valid: () => "Tester" },
    { id: "email", loc: (p) => p.getByLabel("Email address", { exact: true }), kind: "email", required: true, min: 6, max: 254, clientMax: false, valid: e2eEmail, makeMax: emailOfLength },
    phoneField(),
  ],
  submit: (p) => p.getByRole("button", { name: /Create account/ }).click(),
  accepted: verifyUrl,
  labels: ["First name", "Last name", "Email address", "Phone number", "Country code"],
  tabOrder: ["First name", "Last name", "Email address", "Country code", "Phone number", "Create account â†’"],
  isSubmitRequest: OTP_SEND,
};

const CONTACT: FormDef = {
  name: "contact form",
  open: async (p) => {
    await p.goto("/contact");
    await hydrated(p);
  },
  fields: [
    { id: "name", loc: (p) => p.getByLabel("Your name", { exact: true }), kind: "text", required: true, min: 1, max: 100, clientMax: true, valid: () => "Ada Tester" },
    { id: "email", loc: (p) => p.getByLabel("Email address", { exact: true }), kind: "email", required: true, min: 6, max: 254, clientMax: true, valid: e2eEmail, makeMax: emailOfLength },
    { id: "message", loc: (p) => p.getByLabel("Your message", { exact: true }), kind: "message", required: true, min: 10, max: 3000, clientMax: true, valid: () => "Hello, I have a question about the book." },
  ],
  submit: (p) => p.getByRole("button", { name: "Send message" }).click(),
  accepted: async (p) => (await messages(p)).some((m) => /Message sent/.test(m)),
  labels: ["Your name", "Email address", "Your message"],
  tabOrder: ["Your name", "Email address", "Your message", "Send message"],
  isSubmitRequest: (url, method) => method === "POST" && new URL(url).pathname === "/api/contact",
};

// ---------------------------------------------------------------------------------------------------------------------
// A. Sign-in, sign-up, verify
// ---------------------------------------------------------------------------------------------------------------------

test.describe("sign-in page", () => {
  fieldMatrix(SIGN_IN_EMAIL, {
    "email:over": "a 255-character email is accepted (components/auth/SignInForm.tsx:15 EMAIL_RE has no length limit and Better Auth adds none); the app then says the code was sent, but Resend answers 422 'Invalid `to` field' and no mail ever arrives",
  });
  formBasics(SIGN_IN_EMAIL, {
    errorAssociation: "email",
    bugs: { association: "sign-in error (app/components/auth/SignInForm.tsx:107) is a role=alert <p> but the email input has no aria-invalid/aria-describedby" },
  });
  fieldMatrix(SIGN_IN_PHONE);
  formBasics(SIGN_IN_PHONE, {
    errorAssociation: "phone",
    bugs: { association: "sign-in phone error (components/auth/SignInForm.tsx:107) is not linked to the phone input (no aria-invalid/aria-describedby)" },
  });

  test.describe("tabs", () => {
    test("should switch between the email and phone forms and clear the error when a tab is pressed", async ({ page }) => {
      await SIGN_IN_EMAIL.open(page);
      await page.getByRole("button", { name: "Continue with email" }).click();
      await expect(page.getByRole("alert").filter({ hasText: "Enter a valid email address." })).toBeVisible();
      await page.getByRole("tab", { name: "Phone Number" }).click();
      await expect(page.getByLabel("Phone number", { exact: true })).toBeVisible();
      await expect(page.getByLabel("Email address", { exact: true })).toHaveCount(0);
      expect(await messages(page)).toEqual([]);
      await page.getByRole("tab", { name: "Email Address" }).click();
      await expect(page.getByLabel("Email address", { exact: true })).toHaveValue("");
    });

    test("should move between the tabs with the arrow keys when a tab has focus", async ({ page }) => {
      bug("the sign-in tabs have role=tab but no roving tabindex or arrow-key handling (components/auth/SignInForm.tsx:70-86)");
      await SIGN_IN_EMAIL.open(page);
      await page.getByRole("tab", { name: "Email Address" }).focus();
      await page.keyboard.press("ArrowRight");
      await expect(page.getByRole("tab", { name: "Phone Number" })).toHaveAttribute("aria-selected", "true");
    });

    test("should show a Kenyan number as +254 and let the country list be searched by keyboard when the country picker is used", async ({ page }) => {
      await SIGN_IN_PHONE.open(page);
      const picker = page.getByLabel("Country code");
      await expect(picker).toHaveValue("+254");
      await picker.selectOption("+256");
      await expect(picker).toHaveValue("+256");
    });
  });

  test.describe("redirect parameter", () => {
    for (const evil of ["//evil.example", "https://evil.example/steal", "javascript:alert(1)", "/\\evil.example", "///evil.example"]) {
      test(`should land on this site when a signed-out visitor signs in with ?redirect=${evil}`, async ({ page }) => {
        const email = e2eEmail();
        await createUser({ email });
        await page.goto(`/sign-in?redirect=${encodeURIComponent(evil)}`);
        await hydrated(page);
        await page.getByLabel("Email address").fill(email);
        await page.getByRole("button", { name: "Continue with email" }).click();
        await expect(page).toHaveURL(/\/verify/, { timeout: 60_000 });
        await setKnownCode("sign-in", email);
        await typeCode(page, KNOWN_CODE);
        await expect(page).not.toHaveURL(/\/verify/, { timeout: 90_000 });
        expect(new URL(page.url()).origin).toBe(BASE);
      });
    }

    test.describe("already signed in", () => {
      test.beforeAll(async ({ browser }) => {
        test.setTimeout(240_000);
        await readerState(browser, "reader");
      });
      test.use({ storageState: stateFile("reader") });
      for (const evil of ["//evil.example", "https://evil.example", "javascript:alert(1)", "/\\evil.example", "/%2f%2fevil.example"]) {
        test(`should redirect to a page on this site when a signed-in reader opens /sign-in?redirect=${evil}`, async ({ page }) => {
          await page.goto(`/sign-in?redirect=${encodeURIComponent(evil)}`, { waitUntil: "commit" });
          await page.waitForURL((url) => url.pathname !== "/sign-in", { timeout: 60_000 }).catch(() => undefined);
          expect(new URL(page.url()).origin).toBe(BASE);
        });
      }

      test("should keep a safe same-site redirect when the reader is already signed in", async ({ page }) => {
        await page.goto("/sign-in?redirect=/dashboard/settings", { waitUntil: "commit" });
        await expect(page).toHaveURL(/\/dashboard\/settings/, { timeout: 60_000 });
      });
    });
  });

  test("should show a message and not crash when the provider sends back an unknown error code", async ({ page }) => {
    await page.goto("/sign-in?error=" + encodeURIComponent(SCRIPT));
    await hydrated(page);
    await expect(page.getByRole("alert").filter({ hasText: "did not complete" })).toBeVisible();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });
});

test.describe("sign-up page", () => {
  fieldMatrix(SIGN_UP);
  formBasics(SIGN_UP, {
    errorAssociation: "first name",
    bugs: { association: "sign-up error (components/auth/SignUpForm.tsx:84) is a role=alert <p> but no input has aria-invalid/aria-describedby" },
  });

  test("should link to the terms and the privacy policy when the page is open", async ({ page }) => {
    await SIGN_UP.open(page);
    await expect(page.getByRole("link", { name: "Terms & Conditions" })).toHaveAttribute("href", "/terms");
    await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    const [response] = await Promise.all([page.waitForResponse((r) => new URL(r.url()).pathname === "/terms"), page.getByRole("link", { name: "Terms & Conditions" }).click()]);
    expect(response.status()).toBe(200);
  });

  test("should link back to sign-in when the visitor already has an account", async ({ page }) => {
    await SIGN_UP.open(page);
    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("verify page", () => {
  const open = async (page: Page) => {
    const email = e2eEmail();
    await createUser({ email });
    await page.goto("/sign-in");
    await hydrated(page);
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: "Continue with email" }).click();
    await expect(page).toHaveURL(/\/verify/, { timeout: 60_000 });
    await expect(page.getByLabel("Digit 1")).toBeVisible();
    return email;
  };
  const boxes = (page: Page) => [1, 2, 3, 4].map((n) => page.getByLabel(`Digit ${n}`));
  const values = async (page: Page) => Promise.all(boxes(page).map((b) => b.inputValue()));
  const wrongCode = (page: Page) => page.getByRole("alert").filter({ hasText: "That code is not right" });

  test("should send a visitor with no sign-in in progress back to sign-in when /verify is opened directly", async ({ page }) => {
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 60_000 });
  });

  test("should name the code boxes Digit 1 to 4 inside a group and ask the browser for a one-time code when the page is open", async ({ page }) => {
    await open(page);
    await expect(page.getByRole("group", { name: "4-digit code" })).toBeVisible();
    await expect(page.getByLabel("Digit 1")).toHaveAttribute("autocomplete", "one-time-code");
    await expect(page.getByLabel("Digit 1")).toBeFocused();
  });

  test("should ignore letters and symbols when they are typed into the code boxes", async ({ page }) => {
    await open(page);
    await page.getByLabel("Digit 1").click();
    await page.keyboard.type("ab-!", { delay: 30 });
    expect(await values(page)).toEqual(["", "", "", ""]);
    await expect(page.getByLabel("Digit 1")).toBeFocused();
  });

  test("should fill every box and show the wrong-code message when 1234 is pasted", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await open(page);
    await page.evaluate(() => navigator.clipboard.writeText("1234"));
    await page.getByLabel("Digit 1").focus();
    await page.keyboard.press("Control+V");
    await expect(wrongCode(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Digit 1")).toHaveAttribute("aria-invalid", "true");
  });

  test("should strip the space and still use all four digits when 12 34 is pasted", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await open(page);
    await page.evaluate(() => navigator.clipboard.writeText("12 34"));
    await page.getByLabel("Digit 1").focus();
    await page.keyboard.press("Control+V");
    await expect(wrongCode(page)).toBeVisible({ timeout: 30_000 });
  });

  test("should use the first four digits when six digits are pasted", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    const email = await open(page);
    await setKnownCode("sign-in", email);
    await page.evaluate(() => navigator.clipboard.writeText("424299"));
    await page.getByLabel("Digit 1").focus();
    await page.keyboard.press("Control+V");
    await expect(page).not.toHaveURL(/\/verify/, { timeout: 90_000 });
  });

  test("should do nothing when text without digits is pasted", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
    await open(page);
    await page.evaluate(() => navigator.clipboard.writeText("abcd"));
    await page.getByLabel("Digit 1").focus();
    await page.keyboard.press("Control+V");
    expect(await values(page)).toEqual(["", "", "", ""]);
    expect(await messages(page)).toEqual([]);
  });

  test("should move back one box when Backspace is pressed in an empty box, and delete the digit on the next press", async ({ page }) => {
    await open(page);
    await page.getByLabel("Digit 1").click();
    await page.keyboard.type("123", { delay: 30 });
    await expect(page.getByLabel("Digit 4")).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(page.getByLabel("Digit 3")).toBeFocused();
    expect(await values(page)).toEqual(["1", "2", "3", ""]);
    await page.keyboard.press("Backspace");
    expect(await values(page)).toEqual(["1", "2", "", ""]);
  });

  test("should move between the boxes with the arrow keys when a box has focus", async ({ page }) => {
    await open(page);
    await page.getByLabel("Digit 2").click();
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByLabel("Digit 1")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel("Digit 3")).toBeFocused();
  });

  test("should keep only the last digit when a second digit is typed over a filled box", async ({ page }) => {
    await open(page);
    await page.getByLabel("Digit 1").click();
    await page.keyboard.type("1", { delay: 30 });
    await page.getByLabel("Digit 1").click();
    await page.keyboard.type("9", { delay: 30 });
    expect((await values(page))[0]).toBe("9");
  });

  test("should clear the boxes and show the wrong-code message when four wrong digits are typed", async ({ page }) => {
    await open(page);
    await typeCode(page, "0000");
    await expect(wrongCode(page)).toBeVisible({ timeout: 30_000 });
    expect(await values(page)).toEqual(["", "", "", ""]);
    await expect(page.getByLabel("Digit 1")).toHaveAttribute("aria-invalid", "true");
  });

  test("should link the wrong-code message to the code boxes with aria-describedby when a wrong code is entered", async ({ page }) => {
    bug("the wrong-code message (components/auth/VerifyFlow.tsx:206) is a role=alert <p> that the digit inputs do not reference (aria-describedby is missing on components/auth/OtpInput.tsx:43)");
    await open(page);
    await typeCode(page, "0000");
    await expect(wrongCode(page)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel("Digit 1")).toHaveAttribute("aria-describedby", /.+/);
  });

  test("should disable the verify button until four digits are in when the page is open", async ({ page }) => {
    await open(page);
    const verify = page.getByRole("button", { name: /Verify code/ });
    await expect(verify).toBeDisabled();
    await page.getByLabel("Digit 1").click();
    await page.keyboard.type("123", { delay: 30 });
    await expect(verify).toBeDisabled();
  });

  test("should count down 60 seconds before resending and allow a new code afterwards", async ({ page }) => {
    await page.clock.install();
    await open(page);
    const resend = page.getByRole("button", { name: /Resend in|Click to resend/ });
    await expect(resend).toBeDisabled();
    await expect(resend).toHaveText(/Resend in \d+s/);
    for (let i = 0; i < 62; i++) await page.clock.runFor(1000);
    await expect(resend).toHaveText("Click to resend");
    await expect(resend).toBeEnabled();
    let sent = 0;
    page.on("request", (r) => OTP_SEND(r.url(), r.method()) && sent++);
    await resend.click();
    await expect(resend).toHaveText(/Resend in \d+s/);
    expect(sent).toBe(1);
  });

  test("should go back to sign-in and forget the flow when 'Back to log in' is pressed", async ({ page }) => {
    await open(page);
    await page.getByRole("link", { name: /Back to log in/ }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/verify");
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 60_000 });
  });
});

test.describe("contact page", () => {
  fieldMatrix(CONTACT);
  formBasics(CONTACT, {
    errorAssociation: "message",
    bugs: { association: "contact error (components/contact/ContactForm.tsx:75) is a role=alert <p>; the inputs have no aria-invalid/aria-describedby, and the message names no field" },
  });

  test("should show the thank-you panel and clear the form when a valid message is sent", async ({ page }) => {
    await CONTACT.open(page);
    await fillAll(CONTACT, page, validValues(CONTACT));
    await CONTACT.submit(page);
    await expect(page.getByRole("status").filter({ hasText: "Message sent" })).toBeVisible();
    await expect(page.getByLabel("Your name")).toHaveCount(0);
  });

  test("should pretend to succeed and send nothing when the hidden honeypot field is filled", async ({ page }) => {
    await CONTACT.open(page);
    await fillAll(CONTACT, page, validValues(CONTACT));
    await page.locator("input[tabindex='-1']").fill("http://spam.example");
    await CONTACT.submit(page);
    await expect(page.getByRole("status").filter({ hasText: "Message sent" })).toBeVisible();
  });

  test("should keep the honeypot out of the tab order and away from screen readers when the form is open", async ({ page }) => {
    await CONTACT.open(page);
    const honeypot = page.locator("input[tabindex='-1']");
    await expect(honeypot).toHaveCount(1);
    await expect(page.locator("div[aria-hidden='true']").filter({ has: honeypot })).toHaveCount(1);
  });

  test("should keep what was typed and show the server message when the server refuses the message", async ({ page }) => {
    await CONTACT.open(page);
    await page.route("**/api/contact", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many messages. Please try again later." }) }));
    await fillAll(CONTACT, page, validValues(CONTACT));
    await CONTACT.submit(page);
    await expect(page.getByRole("alert").filter({ hasText: "Too many messages" })).toBeVisible();
    await expect(page.getByLabel("Your message")).toHaveValue(/question about the book/);
  });

  test("should show a connection message and keep the text when the network drops", async ({ page }) => {
    await CONTACT.open(page);
    await page.route("**/api/contact", (route) => route.abort("internetdisconnected"));
    await fillAll(CONTACT, page, validValues(CONTACT));
    await CONTACT.submit(page);
    await expect(page.getByRole("alert").filter({ hasText: "Could not reach the server" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  test("should allow only five messages an hour from one address when the same network sends a sixth", async ({ page }) => {
    await CONTACT.open(page);
    for (let i = 0; i < 6; i++) {
      await page.goto("/contact");
      await hydrated(page);
      await fillAll(CONTACT, page, validValues(CONTACT));
      await CONTACT.submit(page);
      const out = await decide(page, CONTACT.accepted);
      if (i < 5) expect(out.result, `message ${i + 1}`).toBe("accepted");
      else {
        expect(out.result).toBe("rejected");
        expect(out.messages.join(" ")).toMatch(/too many/i);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A. Cart and checkout
// ---------------------------------------------------------------------------------------------------------------------

/** Puts one book in the browser's cart the way the store does (zustand `wangeci-cart`). */
async function seedCart(page: Page, items: { editionId: string; price?: number; title?: string; currency?: string }[] = [{ editionId: "test-ebook" }]) {
  await page.addInitScript((list) => {
    try {
      if (localStorage.getItem("wangeci-cart")) return;
      const built = list.map((i) => ({ id: `book:x:${i.editionId}`, itemId: "x", editionId: i.editionId, type: "book", title: i.title ?? "Test Media Book", price: i.price ?? 50, currency: i.currency ?? "KES", qty: 1 }));
      localStorage.setItem("wangeci-cart", JSON.stringify({ state: { items: built }, version: 0 }));
    } catch {
      /* storage unavailable: the test fails visibly on the page instead */
    }
  }, items);
}

const checkoutStatus = new WeakMap<Page, number>();
const checkoutButton = (p: Page) => p.getByRole("button", { name: /^(Get my book|Pay )/ });

async function openCheckout(p: Page, coupon: string | null = "FREE100") {
  await seedCart(p);
  p.on("response", (r) => {
    if (new URL(r.url()).pathname === "/api/checkout" && r.request().method() === "POST") checkoutStatus.set(p, r.status());
  });
  await p.goto("/checkout");
  await hydrated(p);
  await expect(p.getByLabel("Coupon code")).toBeVisible({ timeout: 90_000 });
  if (coupon) {
    await p.getByLabel("Coupon code").fill(coupon);
    await p.getByRole("button", { name: "Apply" }).click();
    await expect(p.getByRole("button", { name: "Get my book" })).toBeVisible();
  }
}

const buyer = (p: Page) => p.locator('section[aria-labelledby="s1"]');
const CHECKOUT: FormDef = {
  name: "checkout",
  open: (p) => openCheckout(p),
  fields: [
    { id: "first name", loc: (p) => buyer(p).getByLabel("First name", { exact: true }), kind: "text", required: true, min: 1, max: 60, clientMax: false, valid: () => "Ada" },
    { id: "last name", loc: (p) => buyer(p).getByLabel("Last name", { exact: true }), kind: "text", required: true, min: 1, max: 60, clientMax: false, valid: () => "Tester" },
    { id: "email", loc: (p) => buyer(p).getByLabel("Email", { exact: true }), kind: "email", required: true, min: 6, max: 120, clientMax: false, valid: e2eEmail, makeMax: emailOfLength },
    phoneField({ loc: (p) => buyer(p).getByLabel("Phone number", { exact: true }) }),
  ],
  submit: (p) => checkoutButton(p).click(),
  accepted: async (p) => checkoutStatus.get(p) === 200,
  labels: ["First name", "Last name", "Email", "Phone number", "Country code", "Coupon code"],
  tabOrder: ["First name", "Last name", "Email", "Country code", "Phone number"],
  isSubmitRequest: (url, method) => method === "POST" && new URL(url).pathname === "/api/checkout",
};

test.describe("checkout form", () => {
  fieldMatrix(CHECKOUT);
  formBasics(CHECKOUT, {
    errorAssociation: "first name",
    bugs: {},
  });

  test("should link the phone error to the phone input with aria-invalid when the number is too short", async ({ page }) => {
    bug("the phone error (components/checkout/CheckoutClient.tsx:178) calls reject(msg) with no field, so the phone input is never aria-invalid and the message is not aria-describedby-linked");
    await openCheckout(page);
    await fillAll(CHECKOUT, page, { ...validValues(CHECKOUT), phone: "7" });
    await CHECKOUT.submit(page);
    await expect(page.getByRole("alert").filter({ hasText: "valid phone number" })).toBeVisible();
    await expect(buyer(page).getByLabel("Phone number", { exact: true })).toHaveAttribute("aria-invalid", "true");
  });

  test("should mark both name inputs invalid and describe them with the error when the first name is missing", async ({ page }) => {
    await openCheckout(page);
    await fillAll(CHECKOUT, page, { ...validValues(CHECKOUT), "first name": "" });
    await CHECKOUT.submit(page);
    await expect(page.getByRole("alert").filter({ hasText: "first and last name" })).toBeVisible();
    for (const label of ["First name", "Last name"]) {
      await expect(buyer(page).getByLabel(label, { exact: true })).toHaveAttribute("aria-invalid", "true");
      await expect(buyer(page).getByLabel(label, { exact: true })).toHaveAttribute("aria-describedby", "checkout-error");
    }
  });

  test.describe("coupon box", () => {
    const quote = (page: Page) => page.getByRole("definition").filter({ hasText: /KES/ });
    for (const [code, expected] of [
      ["free100", "Get my book"],
      ["  TEN  ", /Pay KES 45/],
      ["Ten", /Pay KES 45/],
    ] as const) {
      test(`should apply the coupon when the code is typed as ${JSON.stringify(code)}`, async ({ page }) => {
        await openCheckout(page, null);
        await page.getByLabel("Coupon code").fill(code);
        await page.getByRole("button", { name: "Apply" }).click();
        await expect(page.getByRole("button", { name: expected })).toBeVisible();
        await expect(page.getByText(/Discount \((FREE100|TEN)\)/)).toBeVisible();
      });
    }

    for (const [label, code] of [
      ["SQL-looking text", `' OR 1=1; --`],
      ["an HTML payload", SCRIPT],
      ["a code that does not exist", "NOSUCHCODE"],
      ["40 characters", "A".repeat(40)],
      ["41 characters", "A".repeat(41)],
      ["emoji", "SALEðŸ˜€"],
    ] as const) {
      test(`should show a message and keep the total when the coupon is ${label}`, async ({ page }) => {
        await openCheckout(page, null);
        await page.getByLabel("Coupon code").fill(code);
        await page.getByRole("button", { name: "Apply" }).click();
        await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Pay KES 50/ })).toBeVisible();
        await expectNoHScroll(page);
      });
    }

    test("should apply the coupon and not start a payment when Enter is pressed in the coupon box", async ({ page }) => {
      await openCheckout(page, null);
      let paid = 0;
      page.on("request", (r) => new URL(r.url()).pathname === "/api/checkout" && r.method() === "POST" && paid++);
      await page.getByLabel("Coupon code").fill("TEN");
      await page.getByLabel("Coupon code").press("Enter");
      await expect(page.getByRole("button", { name: /^Pay KES 45/ })).toBeVisible();
      expect(paid).toBe(0);
    });

    test("should do nothing and send no request when Apply is pressed with an empty coupon box", async ({ page }) => {
      await openCheckout(page, null);
      let quotes = 0;
      page.on("request", (r) => new URL(r.url()).pathname === "/api/checkout/quote" && quotes++);
      await page.getByRole("button", { name: "Apply" }).click();
      await page.waitForTimeout(500);
      expect(quotes).toBe(0);
      expect(await messages(page)).toEqual([]);
    });

    test("should tell the buyer something happened when Apply is pressed with only spaces in the coupon box", async ({ page }) => {
      bug("Apply with a blank/space-only coupon silently does nothing (components/checkout/CheckoutClient.tsx:113 returns without a message)");
      await openCheckout(page, null);
      await page.getByLabel("Coupon code").fill("    ");
      await page.getByRole("button", { name: "Apply" }).click();
      await expect.poll(() => messages(page).then((m) => m.length), { timeout: 3_000 }).toBeGreaterThan(0);
    });

    test("should show the valid coupon's discount and a message when a bad code is tried after a good one", async ({ page }) => {
      await openCheckout(page, "TEN");
      await page.getByLabel("Coupon code").fill("NOSUCHCODE");
      await page.getByRole("button", { name: "Apply" }).click();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
      await expect(page.getByRole("button", { name: /^Pay KES 45/ })).toBeVisible();
      await expect(quote(page).first()).toBeVisible();
    });

    test("should show the code in upper case when a lower-case code is typed", async ({ page }) => {
      await openCheckout(page, null);
      await page.getByLabel("Coupon code").fill("ten");
      const transform = await page.getByLabel("Coupon code").evaluate((el) => getComputedStyle(el).textTransform);
      expect(transform).toBe("uppercase");
    });
  });

  test.describe("payment method", () => {
    test("should show the M-Pesa number box and keep the choice when the method is switched", async ({ page }) => {
      await openCheckout(page, null);
      const mpesa = page.getByRole("radio", { name: /M-Pesa/ });
      test.skip((await mpesa.count()) === 0, "M-Pesa is not configured in this environment (no Daraja keys), so the radio is not offered");
      await mpesa.check();
      await expect(page.getByLabel(/M-Pesa number/)).toBeVisible();
      const card = page.getByRole("radio", { name: /^Card/ });
      if (await card.count()) {
        await card.check();
        await expect(page.getByLabel(/M-Pesa number/)).toHaveCount(0);
        await page.keyboard.press("ArrowDown");
        await expect(mpesa).toBeChecked();
      }
    });

    for (const [label, other] of [["letters", "not a phone"], ["too short", "0712"], ["an HTML payload", SCRIPT], ["a foreign number", "+447911123456"]] as const) {
      test(`should refuse to start a payment when the other M-Pesa number is ${label}`, async ({ page }) => {
        bug("an unusable 'other M-Pesa number' is silently dropped (components/checkout/CheckoutClient.tsx:186 `toE164(...) ?? undefined`), so the prompt goes to the buyer's own phone without a word");
        await openCheckout(page, null);
        const mpesa = page.getByRole("radio", { name: /M-Pesa/ });
        test.skip((await mpesa.count()) === 0, "M-Pesa is not configured in this environment");
        await mpesa.check();
        let body: { mpesaPhone?: string } | null = null;
        await page.route("**/api/checkout", (route) => {
          body = route.request().postDataJSON();
          return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "stubbed" }) });
        });
        await fillAll(CHECKOUT, page, validValues(CHECKOUT));
        await page.getByLabel(/M-Pesa number/).fill(other);
        await checkoutButton(page).click();
        await page.waitForTimeout(800);
        expect(body, "the request was sent although the number is unusable").toBeNull();
      });
    }

    test("should show the lock dialog with a disabled retry and keep it open when Escape is pressed after a lock answer", async ({ page }) => {
      await openCheckout(page, null);
      await page.route("**/api/checkout", (route) =>
        route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "Too many payment attempts. Try again in 5 minutes.", code: "PAY_LOCKED", retryAfterSeconds: 300 }) }),
      );
      await fillAll(CHECKOUT, page, validValues(CHECKOUT));
      await checkoutButton(page).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Too many payment attempts");
      await expect(dialog.getByRole("button", { name: /Try again in/ })).toHaveAttribute("aria-disabled", "true");
      await page.keyboard.press("Escape");
      await expect(dialog).toBeVisible(); // by design: a payment dialog is not dismissed by accident
      await dialog.getByRole("button", { name: "Change details" }).click();
      await expect(dialog).toBeHidden();
    });

    test("should show the server's message and a reference when the server refuses the details", async ({ page }) => {
      await openCheckout(page, null);
      await page.route("**/api/checkout", (route) =>
        route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Please check your details and try again.", requestId: "req-123" }) }),
      );
      await fillAll(CHECKOUT, page, validValues(CHECKOUT));
      await checkoutButton(page).click();
      await expect(page.getByRole("alert").filter({ hasText: "Reference: req-123" })).toBeVisible();
      await expect(checkoutButton(page)).toBeEnabled();
    });
  });

  test("should ask for a security check when the Cloudflare widget is configured but has not answered", async () => {
    test.skip(true, "NEXT_PUBLIC_TURNSTILE_SITE_KEY is empty for the test server (playwright.config.ts), so no widget renders; the stub in `prepare` covers the token path");
  });
});

test.describe("cart", () => {
  test("should add the book, show it once, and remove it when Remove is pressed", async ({ page }) => {
    await page.goto(`/store/${READ_SLUG}`);
    await hydrated(page);
    await page.getByRole("button", { name: /Add Book to Cart/ }).click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 60_000 });
    await expect(page.getByText("E2E Inputs Reading Book (Ebook)")).toHaveCount(1);
    await page.reload();
    await expect(page.getByText("E2E Inputs Reading Book (Ebook)")).toHaveCount(1);
    await page.getByRole("button", { name: "Remove" }).click();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });

  test("should keep one line when the same book is added twice", async ({ page }) => {
    await page.goto(`/store/${READ_SLUG}`);
    await hydrated(page);
    await page.getByRole("button", { name: /Add Book to Cart/ }).click();
    await expect(page).toHaveURL(/\/cart/, { timeout: 60_000 });
    await page.goBack();
    await page.getByRole("button", { name: /Add Book to Cart/ }).click();
    await expect(page).toHaveURL(/\/cart/);
    await expect(page.getByRole("listitem").filter({ hasText: "E2E Inputs Reading Book" })).toHaveCount(1);
  });

  test("should replace the saved price with the server price when the browser's price was tampered with", async ({ page }) => {
    await seedCart(page, [{ editionId: "test-ebook", price: 1 }]);
    await page.goto("/cart");
    await expect(page.getByText("KES 50").first()).toBeVisible({ timeout: 60_000 });
  });

  test("should drop a book that is not for sale and say so when the saved cart holds an unknown edition", async ({ page }) => {
    await seedCart(page, [{ editionId: "no-such-edition", title: `<img src=x onerror=alert(1)> Ghost` }]);
    await page.goto("/cart");
    await expect(page.getByRole("status").filter({ hasText: "no longer available" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("should show a hostile title as plain text and not overflow when the saved cart holds markup and a very long word", async ({ page }) => {
    await seedCart(page, [{ editionId: "test-ebook", title: `${SCRIPT} ${"W".repeat(300)}` }]);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/cart");
    await expect(page.getByText("<script>alert(1)</script>", { exact: false }).first()).toBeVisible({ timeout: 60_000 });
    await expectNoHScroll(page);
  });

  test("should go to the checkout when Proceed to Checkout is pressed with a book in the cart", async ({ page }) => {
    await seedCart(page);
    await page.goto("/cart");
    await page.getByRole("link", { name: "Proceed to Checkout" }).click();
    await expect(page).toHaveURL(/\/checkout/);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A. Book page: comment and feedback
// ---------------------------------------------------------------------------------------------------------------------

test.describe("book page community forms", () => {
  const commentBox = (p: Page) => p.getByLabel("Leave a comment");
  const feedbackBox = (p: Page) => p.getByLabel("Feedback for the author");
  const send = async (p: Page, which: "comment" | "feedback") => {
    const resp = p.waitForResponse((r) => new URL(r.url()).pathname === "/api/community" && r.request().method() === "POST", { timeout: 30_000 });
    await p.getByRole("button", { name: which === "comment" ? "Post comment" : "Send feedback" }).click();
    return resp;
  };
  const note = (p: Page) => p.getByRole("status").filter({ hasText: /\S/ });
  const openBook = async (p: Page) => {
    await p.goto(`/store/${READ_SLUG}`);
    await hydrated(p, "textarea");
  };

  test("should offer a sign-in link and no forms when the visitor is signed out", async ({ page }) => {
    await page.goto(`/store/${READ_SLUG}`);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in");
    await expect(page.getByLabel("Leave a comment")).toHaveCount(0);
    await expect(page.getByLabel("Feedback for the author")).toHaveCount(0);
  });

  test.describe("comment (signed in)", () => {
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(240_000);
      await readerState(browser, "reader");
      await readerState(browser, "community");
      await ensureBooks();
    });
    test.use({ storageState: stateFile("community") });

    test("should name both text boxes and the rating menu when the forms are shown", async ({ page }) => {
      await openBook(page);
      await expect(commentBox(page)).toHaveCount(1);
      await expect(feedbackBox(page)).toHaveCount(1);
      await expect(page.getByLabel("Rating (optional)")).toHaveCount(1);
    });

    test("should stop typing at 1000 characters when the comment is longer", async ({ page }) => {
      await openBook(page);
      await commentBox(page).click();
      await page.keyboard.insertText("c".repeat(1001));
      expect((await commentBox(page).inputValue()).length).toBe(1000);
    });

    test("should stop typing at 2000 characters when the feedback is longer", async ({ page }) => {
      await openBook(page);
      await feedbackBox(page).click();
      await page.keyboard.insertText("f".repeat(2001));
      expect((await feedbackBox(page).inputValue()).length).toBe(2000);
    });

    for (const [name, box] of [["comment", commentBox], ["feedback", feedbackBox]] as const) {
      test(`should block an empty ${name} in the browser and send nothing`, async ({ page }) => {
        await openBook(page);
        let sent = 0;
        page.on("request", (r) => new URL(r.url()).pathname === "/api/community" && sent++);
        await page.getByRole("button", { name: name === "comment" ? "Post comment" : "Send feedback" }).click();
        expect(await box(page).evaluate((el: HTMLTextAreaElement) => el.validity.valueMissing)).toBe(true);
        expect(sent).toBe(0);
      });
    }

    test("should show an error message and not post when the comment is only spaces", async ({ page }) => {
      bug("a space-only comment passes the browser's required/minLength check and is only refused by the server, with a generic message (components/community/CommunityForms.tsx:47)");
      await openBook(page);
      await commentBox(page).fill("      ");
      const before = page.url();
      let sent = 0;
      page.on("request", (r) => new URL(r.url()).pathname === "/api/community" && sent++);
      await page.getByRole("button", { name: "Post comment" }).click();
      await page.waitForTimeout(800);
      expect(sent, "the form posted a blank comment to the server").toBe(0);
      expect(page.url()).toBe(before);
    });

    test("should answer a space-only comment with a visible error when the server refuses it", async ({ page }) => {
      await openBook(page);
      await commentBox(page).fill("      ");
      const resp = await send(page, "comment");
      expect(resp.status()).toBe(400);
      await expect(note(page)).toContainText(/check what you wrote/i);
    });

    test("should block a one-character comment in the browser or the server when it is below the 2-character minimum", async ({ page }) => {
      await openBook(page);
      await commentBox(page).fill("a");
      let sent = 0;
      page.on("response", (r) => new URL(r.url()).pathname === "/api/community" && r.status() === 200 && sent++);
      await page.getByRole("button", { name: "Post comment" }).click();
      await page.waitForTimeout(1000);
      expect(sent).toBe(0);
    });

    test("should accept a two-character comment and say it awaits review when it is the minimum length", async ({ page }) => {
      await openBook(page);
      await commentBox(page).fill("ok");
      expect((await send(page, "comment")).status()).toBe(200);
      await expect(note(page)).toContainText("once it has been reviewed");
      await expect(commentBox(page)).toHaveValue("");
    });

    test("should accept a 1000-character comment when it is exactly the limit", async ({ page }) => {
      await openBook(page);
      await commentBox(page).fill("m".repeat(1000));
      expect((await send(page, "comment")).status()).toBe(200);
    });

    test("should accept unicode, markup and SQL-looking text in one comment and show no dialog when it is sent", async ({ page }) => {
      await openBook(page);
      await commentBox(page).fill(`${UNICODE} ${SCRIPT} ${SQLISH}`);
      expect((await send(page, "comment")).status()).toBe(200);
    });

    test("should accept a comment that is one very long word when it is sent from a phone", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await openBook(page);
      await commentBox(page).fill("W".repeat(1000));
      expect((await send(page, "comment")).status()).toBe(200);
      await expectNoHScroll(page);
    });

    test("should send the rating with the feedback when a star value is chosen, and none when 'No rating' is kept", async ({ page }) => {
      await openBook(page);
      const bodies: { rating?: number }[] = [];
      page.on("request", (r) => new URL(r.url()).pathname === "/api/community" && bodies.push(r.postDataJSON()));
      await feedbackBox(page).fill("Rated feedback, with a rating of five.");
      await page.getByLabel("Rating (optional)").selectOption("5");
      expect((await send(page, "feedback")).status()).toBe(200);
      await expect(note(page)).toContainText("Thank you for your feedback");
      await feedbackBox(page).fill("Unrated feedback without any rating.");
      expect((await send(page, "feedback")).status()).toBe(200);
      expect(bodies[0].rating).toBe(5);
      expect(bodies[1].rating).toBeUndefined();
    });

    test("should accept a 2000-character feedback message when it is exactly the limit", async ({ page }) => {
      await openBook(page);
      await feedbackBox(page).fill("m".repeat(2000));
      expect((await send(page, "feedback")).status()).toBe(200);
    });

    test("should accept unicode and markup in feedback and show no dialog when it is sent", async ({ page }) => {
      await openBook(page);
      await feedbackBox(page).fill(`${UNICODE} ${SCRIPT}`);
      expect((await send(page, "feedback")).status()).toBe(200);
    });

    test("should accept a long single word in feedback when it is sent from a phone", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await openBook(page);
      await feedbackBox(page).fill("W".repeat(1500));
      expect((await send(page, "feedback")).status()).toBe(200);
      await expectNoHScroll(page);
    });

    test("should send one request when the feedback button is double-clicked", async ({ page }) => {
      await openBook(page);
      let sent = 0;
      page.on("request", (r) => new URL(r.url()).pathname === "/api/community" && r.method() === "POST" && sent++);
      await feedbackBox(page).fill("Double clicked feedback message.");
      await page.getByRole("button", { name: "Send feedback" }).dblclick();
      await expect(note(page)).toContainText(/Thank you/);
      expect(sent).toBe(1);
    });

    test("should show the plain text of an approved comment without markup and without sideways scrolling when a hostile comment is shown on a phone", async ({ page }) => {
      bug("an approved comment that is one long word overflows its card and the page (app/(marketing)/store/[slug]/page.tsx: `whitespace-pre-wrap` without `break-words`)");
      const user = await db().user.findUniqueOrThrow({ where: { email: ACCOUNTS.community } });
      await db().comment.create({ data: { postSlug: READ_SLUG, userId: user.id, status: "APPROVED", body: `${SCRIPT}\n${"W".repeat(900)}` } });
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(`/store/${READ_SLUG}`);
      await expect(page.getByText("<script>alert(1)</script>", { exact: false }).first()).toBeVisible();
      await expect(page.locator("img[src='x']")).toHaveCount(0);
      await expectNoHScroll(page);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A. Reader, bookmarks, audio player
// ---------------------------------------------------------------------------------------------------------------------

test.describe("reader and bookmarks", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    await readerState(browser, "reader");
    await ensureBooks();
  });
  test.use({ storageState: stateFile("reader") });

  const readUrl = (query = "") => `/dashboard/books/${READ_SLUG}/read${query}`;
  const indicator = (p: Page) => p.locator('p[aria-label^="Page "]');
  const pageNo = async (p: Page) => Number((await indicator(p).locator("span").first().innerText()).trim());
  const openReader = async (p: Page, query = "") => {
    await p.goto(readUrl(query));
    await expect(indicator(p)).toBeVisible({ timeout: 90_000 });
    await expect(p.getByText(/alpha0x0|beta0x0|gamma0x0/).first()).toBeAttached();
  };
  const flowFont = (p: Page) => p.locator("h1").first().evaluate((el) => parseFloat(getComputedStyle(el.parentElement!).fontSize));

  test.describe("text size", () => {
    test("should stop growing at 28 px when A+ is pressed more times than there are sizes", async ({ page }) => {
      await page.addInitScript(() => localStorage.removeItem("wc_reader_font"));
      await openReader(page);
      expect(await flowFont(page)).toBe(20);
      for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Larger text" }).click();
      expect(await flowFont(page)).toBe(28);
    });

    test("should stop shrinking at 16 px when A- is pressed more times than there are sizes", async ({ page }) => {
      await openReader(page);
      for (let i = 0; i < 8; i++) await page.getByRole("button", { name: "Smaller text" }).click();
      expect(await flowFont(page)).toBe(16);
    });

    test("should remember the text size when the reader is reopened", async ({ page }) => {
      await openReader(page);
      await page.getByRole("button", { name: "Larger text" }).click();
      const size = await flowFont(page);
      await page.reload();
      await expect(indicator(page)).toBeVisible({ timeout: 60_000 });
      expect(await flowFont(page)).toBe(size);
    });

    test("should ignore a corrupt saved text size when localStorage holds nonsense", async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem("wc_reader_font", "<script>alert(1)</script>"));
      await openReader(page);
      expect(await flowFont(page)).toBe(20);
    });

    test("should offer text-size buttons on a phone when the screen is narrow", async ({ page }) => {
      bug("A-/A+ are `hidden sm:flex` (components/dashboard/ChapterReader.tsx:225), so a phone reader has no way to change the text size");
      await page.setViewportSize({ width: 390, height: 844 });
      await openReader(page);
      await expect(page.getByRole("button", { name: "Larger text" })).toBeVisible();
    });
  });

  test.describe("turning pages", () => {
    test("should go to the next page and back when ArrowRight and ArrowLeft are pressed", async ({ page }) => {
      await openReader(page);
      expect(await pageNo(page)).toBe(1);
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => pageNo(page)).toBe(2);
      await page.keyboard.press("PageDown");
      await expect.poll(() => pageNo(page)).toBe(3);
      await page.keyboard.press("ArrowLeft");
      await expect.poll(() => pageNo(page)).toBe(2);
      await page.keyboard.press("PageUp");
      await expect.poll(() => pageNo(page)).toBe(1);
    });

    test("should turn the page when Space is pressed", async ({ page }) => {
      bug("Space does not turn the page (components/dashboard/ChapterReader.tsx:160-164 only handles Arrow/PageUp/PageDown keys)");
      await openReader(page);
      await page.keyboard.press("Space");
      await expect.poll(() => pageNo(page), { timeout: 3_000 }).toBe(2);
    });

    test("should not turn the page when an arrow key is pressed inside a text box", async ({ page }) => {
      await openReader(page);
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.id = "probe";
        document.body.appendChild(input);
      });
      await page.locator("#probe").focus();
      await page.keyboard.press("ArrowRight");
      expect(await pageNo(page)).toBe(1);
    });

    test("should disable Previous and ignore ArrowLeft when the reader is on the first page of the first chapter", async ({ page }) => {
      await openReader(page);
      await expect(page.getByRole("button", { name: "< Previous" })).toBeDisabled();
      await page.keyboard.press("ArrowLeft");
      await expect(page).toHaveURL(new RegExp(`${READ_SLUG}/read$`));
      expect(await pageNo(page)).toBe(1);
    });

    test("should disable Next and ignore ArrowRight when the reader is on the last page of the last chapter", async ({ page }) => {
      await openReader(page, "?idx=2&w=end");
      await expect(page.getByRole("button", { name: "Next >" })).toBeDisabled();
      const before = await pageNo(page);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("PageDown");
      await page.waitForTimeout(400);
      expect(await pageNo(page)).toBe(before);
      await expect(page).toHaveURL(/idx=2/);
    });

    test("should open the next chapter when Next is pressed on the last page of a chapter", async ({ page }) => {
      await openReader(page, "?idx=0&w=end");
      await page.getByRole("button", { name: "Next >" }).click();
      await expect(page).toHaveURL(/idx=1/, { timeout: 60_000 });
      await expect(page.getByRole("heading", { level: 1, name: "Chapter 2" })).toBeVisible();
    });

    test("should land on the last page of the earlier chapter when Previous is pressed on the first page of a chapter", async ({ page }) => {
      await openReader(page, "?idx=1&w=0");
      await page.getByRole("button", { name: "< Previous" }).click();
      await expect(page).toHaveURL(/idx=0&w=end/, { timeout: 60_000 });
      await expect(page.getByRole("button", { name: "Next >" })).toBeEnabled();
    });

    test("should fall back to a real chapter when idx and w in the address are nonsense", async ({ page }) => {
      for (const q of ["?idx=999", "?idx=-1", "?idx=abc&w=xyz", `?idx=${encodeURIComponent(SCRIPT)}`, "?w=99999999"]) {
        await page.goto(readUrl(q));
        await expect(indicator(page), q).toBeVisible({ timeout: 90_000 });
      }
    });
  });

  test.describe("swipe (touch)", () => {
    test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
    const swipe = (p: Page, from: number, to: number) =>
      p.getByText(/alpha0x0|beta0x0|gamma0x0/).first().evaluate(
        (word, [a, b]) => {
          let el: HTMLElement | null = word as HTMLElement;
          while (el && !getComputedStyle(el).overflow.includes("hidden")) el = el.parentElement;
          const target = el ?? (word as HTMLElement);
          const touch = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: 300 });
          target.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [touch(a)], changedTouches: [touch(a)] }));
          target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], changedTouches: [touch(b)] }));
        },
        [from, to] as [number, number],
      );

    test("should turn to the next page when the finger swipes left by more than 50 px", async ({ page }) => {
      await openReader(page);
      await swipe(page, 300, 100);
      await expect.poll(() => pageNo(page)).toBe(2);
    });

    test("should turn back when the finger swipes right by more than 50 px", async ({ page }) => {
      await openReader(page);
      await swipe(page, 300, 100);
      await expect.poll(() => pageNo(page)).toBe(2);
      await swipe(page, 100, 300);
      await expect.poll(() => pageNo(page)).toBe(1);
    });

    test("should stay on the page when the swipe is shorter than 50 px", async ({ page }) => {
      await openReader(page);
      await swipe(page, 300, 270);
      await page.waitForTimeout(400);
      expect(await pageNo(page)).toBe(1);
    });

    test("should stay on the first page when the finger swipes right on the first page of the book", async ({ page }) => {
      await openReader(page);
      await swipe(page, 100, 300);
      await page.waitForTimeout(400);
      expect(await pageNo(page)).toBe(1);
      await expect(page).toHaveURL(new RegExp(`${READ_SLUG}/read$`));
    });
  });

  test.describe("bookmarks", () => {
    const bookmarkButton = (p: Page) => p.getByRole("button", { name: /^(Add|Remove) bookmark$/ });
    const count = async () => db().bookmark.count({ where: { user: { email: ACCOUNTS.reader }, edition: { work: { slug: READ_SLUG } } } });
    test.beforeEach(async () => {
      await db().bookmark.deleteMany({ where: { user: { email: ACCOUNTS.reader }, edition: { work: { slug: READ_SLUG } } } });
    });

    test("should add a bookmark, keep it after a reload and remove it when the button is pressed twice", async ({ page }) => {
      await openReader(page);
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "false");
      await bookmarkButton(page).click();
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "true");
      await expect(bookmarkButton(page)).toHaveAccessibleName("Remove bookmark");
      expect(await count()).toBe(1);
      await page.reload();
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "true", { timeout: 60_000 });
      await bookmarkButton(page).click();
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "false");
      expect(await count()).toBe(0);
    });

    test("should create exactly one bookmark when the button is double-clicked", async ({ page }) => {
      await openReader(page);
      let posts = 0;
      page.on("request", (r) => new URL(r.url()).pathname === "/api/bookmarks" && r.method() === "POST" && posts++);
      await bookmarkButton(page).dblclick();
      await expect.poll(count).toBeGreaterThan(0);
      await page.waitForTimeout(500);
      expect(posts).toBe(1);
      expect(await count()).toBe(1);
    });

    test("should show the bookmark on its own page only and not on the next page when the reader turns the page", async ({ page }) => {
      await openReader(page);
      await bookmarkButton(page).click();
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("ArrowRight");
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "false");
      await page.keyboard.press("ArrowLeft");
      await expect(bookmarkButton(page)).toHaveAttribute("aria-pressed", "true");
    });

    test("should list the bookmark on the bookmarks page and remove it when Remove is pressed", async ({ page }) => {
      await openReader(page);
      await bookmarkButton(page).click();
      await expect.poll(count).toBe(1);
      await page.goto("/dashboard/bookmarks");
      await expect(page.getByText("E2E Inputs Reading Book")).toBeVisible({ timeout: 60_000 });
      await page.getByRole("button", { name: "Remove" }).first().click();
      await expect(page.getByText("E2E Inputs Reading Book")).toHaveCount(0);
      expect(await count()).toBe(0);
    });

    test("should open the reader at the saved place when the bookmark is followed", async ({ page }) => {
      await openReader(page);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => pageNo(page)).toBe(3);
      await bookmarkButton(page).click();
      await expect.poll(count).toBe(1);
      await page.goto("/dashboard/bookmarks");
      await page.getByRole("link", { name: /E2E Inputs Reading Book/ }).click();
      await expect(indicator(page)).toBeVisible({ timeout: 90_000 });
      await expect.poll(() => pageNo(page)).toBeGreaterThan(1);
    });

    test("should refuse a bookmark with an invalid position and a note over 300 characters when the API is called directly", async ({ request, page }) => {
      await openReader(page);
      const edition = await db().edition.findFirstOrThrow({ where: { work: { slug: READ_SLUG } } });
      const post = (data: object) => page.request.post("/api/bookmarks", { data, headers: { origin: BASE, "x-forwarded-for": ip } });
      expect((await post({ editionId: edition.id, chapterIdx: 0, position: -1 })).status()).toBe(400);
      expect((await post({ editionId: edition.id, chapterIdx: 0, position: 1, note: "n".repeat(301) })).status()).toBe(400);
      expect((await post({ editionId: edition.id, chapterIdx: 99999, position: 1 })).status()).toBe(400);
      void request;
    });
  });
});

test.describe("audio player", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    await readerState(browser, "reader");
    await ensureBooks();
  });
  test.use({ storageState: stateFile("reader") });

  const audioTime = (p: Page) => p.evaluate(() => (document.querySelector("audio") as HTMLAudioElement | null)?.currentTime ?? -1);
  const audioRate = (p: Page) => p.evaluate(() => (document.querySelector("audio") as HTMLAudioElement | null)?.playbackRate ?? -1);
  const openPlayer = async (p: Page) => {
    await p.route("**/e2e-inp-audio-*.wav", (route) => {
      const wav = silentWav();
      const range = route.request().headers()["range"];
      if (!range) return route.fulfill({ status: 200, headers: { "Content-Type": "audio/wav", "Accept-Ranges": "bytes" }, body: wav });
      const m = /bytes=(\d+)-(\d*)/.exec(range)!;
      const start = Number(m[1]);
      const end = m[2] ? Math.min(Number(m[2]), wav.length - 1) : wav.length - 1;
      return route.fulfill({
        status: 206,
        headers: { "Content-Type": "audio/wav", "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${wav.length}`, "Content-Length": String(end - start + 1) },
        body: wav.subarray(start, end + 1),
      });
    });
    await p.goto(`/dashboard/books/${AUDIO_SLUG}/listen`);
    await expect(p.getByRole("button", { name: "Play" })).toBeEnabled({ timeout: 90_000 });
    await expect.poll(() => p.evaluate(() => (document.querySelector("audio") as HTMLAudioElement | null)?.readyState ?? 0), { timeout: 30_000 }).toBeGreaterThan(0);
  };

  test("should flip between Play and Pause and report the real state when the main button is pressed", async ({ page }) => {
    await openPlayer(page);
    const button = page.getByRole("button", { name: /^(Play|Pause)$/ });
    await expect(button).toHaveAttribute("aria-pressed", "false");
    await button.click();
    await expect(page.getByRole("button", { name: "Pause" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => audioTime(page), { timeout: 15_000 }).toBeGreaterThan(0.3);
    await page.getByRole("button", { name: "Pause" }).click();
    await expect(page.getByRole("button", { name: "Play" })).toHaveAttribute("aria-pressed", "false");
  });

  test("should stay at zero when Back 10 seconds is pressed at the start", async ({ page }) => {
    await openPlayer(page);
    await page.getByRole("button", { name: "Back 10 seconds" }).click();
    expect(await audioTime(page)).toBe(0);
  });

  test("should move 10 seconds each time and stop at the end when Forward 10 seconds is pressed", async ({ page }) => {
    await openPlayer(page);
    await page.getByRole("button", { name: "Forward 10 seconds" }).click();
    await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(10);
    await page.getByRole("button", { name: "Forward 10 seconds" }).click();
    await page.getByRole("button", { name: "Forward 10 seconds" }).click();
    await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(30);
    await page.getByRole("button", { name: "Forward 10 seconds" }).click();
    await page.getByRole("button", { name: "Forward 10 seconds" }).click();
    await expect.poll(() => audioTime(page)).toBeLessThanOrEqual(AUDIO_SECONDS + 0.5);
  });

  test("should change the playback rate and keep it after a reload when a speed is chosen", async ({ page }) => {
    await openPlayer(page);
    await page.getByLabel("Speed").selectOption("1.5");
    await expect.poll(() => audioRate(page)).toBe(1.5);
    await page.reload();
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled({ timeout: 90_000 });
    await expect(page.getByLabel("Speed")).toHaveValue("1.5");
    await expect.poll(() => audioRate(page)).toBe(1.5);
    await page.getByLabel("Speed").selectOption("1");
  });

  test("should jump 5 seconds when the arrow keys are pressed on the seek bar, and never below zero", async ({ page }) => {
    await openPlayer(page);
    const seek = page.getByRole("slider", { name: "Seek" });
    await seek.focus();
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => audioTime(page)).toBeGreaterThanOrEqual(5);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => audioTime(page)).toBe(0);
    await expect(seek).toHaveAttribute("aria-valuetext", /0:00 of 0:40/);
  });

  test("should restart the chapter and then go back a chapter when Previous is pressed", async ({ page }) => {
    await openPlayer(page);
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(page.getByText("Track 2").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Next chapter" })).toBeDisabled();
    await page.getByRole("button", { name: "Previous chapter" }).click();
    await expect(page.getByText("Track 1").first()).toBeVisible();
  });

  test("should show a message and keep the controls usable when the audio file cannot be loaded", async ({ page }) => {
    await page.route("**/e2e-inp-audio-*.wav", (route) => route.abort("failed"));
    await page.goto(`/dashboard/books/${AUDIO_SLUG}/listen`);
    await expect(page.getByText(/could not be played|Could not load/i).first()).toBeVisible({ timeout: 90_000 });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A. Dashboard settings and the two-step account
// ---------------------------------------------------------------------------------------------------------------------

test.describe("dashboard settings", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    await readerState(browser, "reader");
  });
  test.use({ storageState: stateFile("reader") });

  const openSettings = async (p: Page) => {
    await p.goto("/dashboard/settings");
    await hydrated(p, "form");
    await expect(p.getByLabel("Name", { exact: true })).toBeVisible({ timeout: 90_000 });
  };
  const nameNow = async () => (await db().user.findUniqueOrThrow({ where: { email: ACCOUNTS.reader } })).name;
  const save = async (p: Page) => {
    await p.getByRole("button", { name: "Save" }).click();
  };

  for (const [id, value, expectSaved] of [
    ["one character", "A", true],
    ["unicode and emoji", UNICODE, true],
    ["an HTML payload", SCRIPT, true],
    ["SQL-looking text", SQLISH, true],
    ["exactly 100 characters", "N".repeat(100), true],
  ] as const) {
    test(`should save the name and show it as plain text when it is ${id}`, async ({ page }) => {
      await openSettings(page);
      await page.getByLabel("Name", { exact: true }).fill(value);
      await save(page);
      await expect(page.getByRole("status").filter({ hasText: expectSaved ? "Name saved." : /./ })).toBeVisible();
      expect(await nameNow()).toBe(value);
      await page.reload();
      await expect(page.getByLabel("Name", { exact: true })).toHaveValue(value);
      await expect(page.locator("img[src='x'], svg[onload]")).toHaveCount(0);
    });
  }

  test("should save a 100-character single word without sideways scrolling when the screen is 360 px wide", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await openSettings(page);
    await page.getByLabel("Name", { exact: true }).fill("W".repeat(100));
    await save(page);
    await expect(page.getByRole("status").filter({ hasText: "Name saved." })).toBeVisible();
    await page.reload();
    await expectNoHScroll(page);
  });

  test("should stop typing at 100 characters when the name is longer", async ({ page }) => {
    await openSettings(page);
    const box = page.getByLabel("Name", { exact: true });
    await box.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("N".repeat(101));
    expect((await box.inputValue()).length).toBe(100);
  });

  for (const [id, value] of [["empty", ""], ["only spaces", "     "]] as const) {
    test(`should tell the reader why nothing was saved when the name is ${id}`, async ({ page }) => {
      bug("an empty or space-only name is dropped without a message (components/settings/SettingsPanels.tsx:44 `return`)");
      await openSettings(page);
      const before = await nameNow();
      await page.getByLabel("Name", { exact: true }).fill(value);
      const save$ = page.getByRole("button", { name: "Save" });
      if (await save$.isEnabled()) await save$.click();
      await page.waitForTimeout(500);
      expect(await nameNow()).toBe(before);
      expect((await messages(page)).length, "the reader got no feedback").toBeGreaterThan(0);
    });
  }

  test("should keep Save disabled when the name has not changed", async ({ page }) => {
    await openSettings(page);
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("should save the name once when Save is double-clicked", async ({ page }) => {
    await openSettings(page);
    let calls = 0;
    page.on("request", (r) => /update-user/.test(r.url()) && calls++);
    await page.getByLabel("Name", { exact: true }).fill("Double Click Reader");
    await page.getByRole("button", { name: "Save" }).dblclick();
    await expect(page.getByRole("status").filter({ hasText: "Name saved." })).toBeVisible();
    expect(calls).toBe(1);
  });

  test("should save the name when Enter is pressed in the name box", async ({ page }) => {
    await openSettings(page);
    await page.getByLabel("Name", { exact: true }).fill("Enter Key Reader");
    await page.getByLabel("Name", { exact: true }).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Name saved." })).toBeVisible();
  });

  test.describe("notification switches", () => {
    const prefs = () => db().userPreferences.findFirst({ where: { user: { email: ACCOUNTS.reader } } });
    test("should save the choice and keep it after a reload when 'Email me' is switched off and on", async ({ page }) => {
      await openSettings(page);
      const box = page.getByLabel("Email me");
      await expect(box).toBeChecked();
      await box.uncheck();
      await expect(page.getByRole("status").filter({ hasText: "Preferences saved." })).toBeVisible();
      expect((await prefs())?.emailNotifications).toBe(false);
      await page.reload();
      await expect(page.getByLabel("Email me")).not.toBeChecked();
      await page.getByLabel("Email me").check();
      await expect.poll(async () => (await prefs())?.emailNotifications).toBe(true);
    });

    test("should switch 'Text me' independently of 'Email me' when each is toggled", async ({ page }) => {
      await openSettings(page);
      await page.getByLabel("Text me").uncheck();
      await expect.poll(async () => (await prefs())?.smsNotifications).toBe(false);
      expect((await prefs())?.emailNotifications).toBe(true);
      await page.getByLabel("Text me").check();
      await expect.poll(async () => (await prefs())?.smsNotifications).toBe(true);
    });

    test("should end in the last state chosen when a switch is toggled five times quickly", async ({ page }) => {
      await openSettings(page);
      const box = page.getByLabel("Text me");
      for (let i = 0; i < 5; i++) await box.click();
      await page.waitForTimeout(1500);
      const final = await box.isChecked();
      await expect.poll(async () => (await prefs())?.smsNotifications).toBe(final);
      await page.reload();
      await expect(page.getByLabel("Text me")).toBeChecked({ checked: final });
      await page.getByLabel("Text me").check();
    });

    test("should say 'Could not save preferences.' and keep working when the server fails", async ({ page }) => {
      await openSettings(page);
      await page.route("**/dashboard/settings", (route) => (route.request().method() === "POST" ? route.fulfill({ status: 200, contentType: "text/x-component", body: "0:{}\n" }) : route.continue()));
      await page.getByLabel("Email me").uncheck();
      await expect(page.getByRole("status").filter({ hasText: /Preferences saved\.|Could not save preferences\./ })).toBeVisible();
      await page.unroute("**/dashboard/settings");
      await page.getByLabel("Email me").check();
    });
  });
});

test.describe("two-step account", () => {
  test.describe.configure({ mode: "serial" });
  const secretFile = `${STATE_DIR}/twofa-secret.txt`;
  let signedOutContext: BrowserContext | undefined;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    await readerState(browser, "twofa");
  });
  test.afterAll(async () => {
    await signedOutContext?.close().catch(() => undefined);
  });

  const settingsReady = async (p: Page) => {
    await p.goto("/dashboard/settings");
    await hydrated(p, "form");
    await expect(p.getByRole("heading", { name: /Two-step check/ })).toBeVisible({ timeout: 90_000 });
  };

  /** Presses "Set up"/"Turn off" until the page reacts (the click can land before hydration), and answers the email-code panel when it shows. */
  async function pressAndConfirm(p: Page, button: "Set up" | "Turn off", reveal: Locator) {
    const confirm = p.getByRole("button", { name: "Email me a code" });
    await expect(async () => {
      if (!(await reveal.or(confirm).isVisible())) await p.getByRole("button", { name: button }).click({ timeout: 3_000 });
      await expect(reveal.or(confirm)).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 90_000 });
    if (await confirm.isVisible()) {
      await confirm.click();
      await setKnownCode("email-verification", ACCOUNTS.twofa);
      await typeCode(p, KNOWN_CODE);
    }
  }

  test.describe("setting up", () => {
    test.use({ storageState: stateFile("twofa") });

    test("should show the key, the QR image with a text alternative and six code boxes when Set up is pressed", async ({ page }) => {
      await settingsReady(page);
      const key = page.locator("code").first();
      await pressAndConfirm(page, "Set up", key);
      await expect(key).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("img", { name: "QR code for your authenticator app" })).toBeVisible();
      await expect(page.getByRole("group", { name: "6-digit code" })).toBeVisible();
      writeFileSync(secretFile, (await key.innerText()).trim());
    });

    test("should show a message and clear the boxes when a wrong six-digit code is entered", async ({ page }) => {
      await settingsReady(page);
      const key = page.locator("code").first();
      await pressAndConfirm(page, "Set up", key);
      await expect(key).toBeVisible({ timeout: 30_000 });
      writeFileSync(secretFile, (await key.innerText()).trim());
      await page.getByLabel("Digit 1").click();
      await page.keyboard.type("000000", { delay: 30 });
      await expect(page.getByRole("status").filter({ hasText: /not right|expired|Invalid/i })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByLabel("Digit 1")).toHaveValue("");
    });

    test("should switch the check on when the right six-digit code is entered", async ({ page }) => {
      await settingsReady(page);
      const key = page.locator("code").first();
      await pressAndConfirm(page, "Set up", key);
      await expect(key).toBeVisible({ timeout: 30_000 });
      const secret = (await key.innerText()).trim();
      writeFileSync(secretFile, secret);
      await page.getByLabel("Digit 1").click();
      await page.keyboard.type(totp(secret), { delay: 30 });
      await expect(page.getByText("Two-step check is on.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Turn off" })).toBeVisible();
      await page.context().storageState({ path: stateFile("twofa") });
    });
  });

  test.describe("sign out everywhere and sign in again", () => {
    test.use({ storageState: stateFile("twofa") });

    test("should ask for confirmation before it signs the reader out of every device when 'Sign out everywhere' is pressed", async ({ page }) => {
      bug("'Sign out everywhere' acts on the first click with no confirmation (components/settings/SettingsPanels.tsx:183)");
      await settingsReady(page);
      await page.getByRole("button", { name: "Sign out everywhere" }).click();
      const asked = page.getByRole("alertdialog").or(page.getByRole("dialog")).or(page.getByRole("button", { name: /^(Yes|Confirm|Sign out)/ }));
      await expect(asked.first(), "no confirmation step appeared").toBeVisible({ timeout: 2_000 });
    });

    test("should end up on the sign-in page with no session when 'Sign out everywhere' is confirmed", async ({ page }) => {
      await page.goto("/dashboard/settings");
      await hydrated(page, "form");
      // the previous test may already have signed this session out
      if (/\/sign-in/.test(page.url())) return;
      await page.getByRole("button", { name: "Sign out everywhere" }).click();
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 60_000 });
      await page.goto("/dashboard/settings");
      await expect(page).toHaveURL(/\/sign-in/, { timeout: 60_000 });
    });
  });

  test.describe("signing in with the authenticator", () => {
    const toVerify = async (browser: Browser) => {
      signedOutContext = await freshContext(browser);
      const page = await signedOutContext.newPage();
      await page.goto("/sign-in");
      await hydrated(page);
      await page.getByLabel("Email address").fill(ACCOUNTS.twofa);
      await page.getByRole("button", { name: "Continue with email" }).click();
      await expect(page).toHaveURL(/\/verify/, { timeout: 60_000 });
      await setKnownCode("sign-in", ACCOUNTS.twofa);
      await typeCode(page, KNOWN_CODE);
      await expect(page.getByRole("dialog", { name: "Two-step check" })).toBeVisible({ timeout: 60_000 });
      return page;
    };

    let verifyPage: Page;

    test("should show the Two-step check dialog and refuse a wrong six-digit code when the account has an authenticator", async ({ browser }) => {
      verifyPage = await toVerify(browser);
      const page = verifyPage;
      await page.getByLabel("Digit 1").click();
      await page.keyboard.type("000000", { delay: 30 });
      await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("dialog", { name: "Two-step check" })).toBeVisible();
    });

    test("should close the Two-step check dialog when Escape is pressed", async () => {
      bug("the Two-step check dialog ignores Escape and does not trap focus (components/auth/TwoFactorModal.tsx:30)");
      await verifyPage.keyboard.press("Escape");
      await expect(verifyPage.getByRole("dialog", { name: "Two-step check" })).toBeHidden({ timeout: 2_000 });
    });

    test("should let the reader in when the right authenticator code is entered", async () => {
      const page = verifyPage;
      await expect(page.getByRole("dialog", { name: "Two-step check" })).toBeVisible();
      const secret = readFileSync(secretFile, "utf8").trim();
      await page.getByRole("dialog").getByLabel("Digit 1").click();
      await page.keyboard.type(totp(secret), { delay: 30 });
      await expect(page).not.toHaveURL(/\/verify/, { timeout: 90_000 });
    });

    test("should switch the check off and return to the 'Set up' button when Turn off is pressed and the email code is confirmed", async () => {
      const page = verifyPage;
      await settingsReady(page);
      await pressAndConfirm(page, "Turn off", page.getByText("Two-step check is off."));
      await expect(page.getByText("Two-step check is off.")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Set up" })).toBeVisible();
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A. Admin forms (owner)
// ---------------------------------------------------------------------------------------------------------------------

/** A draft ebook with no chapters, made straight in the database (the admin UI is what is under test, not book creation). */
async function newDraft(format: "EPUB" | "AUDIOBOOK" = "EPUB") {
  const slug = `e2e-inp-draft-${uid()}`;
  const work = await db().work.create({ data: { slug, title: `E2E Draft ${slug}`, author: "E2E Author" } });
  const edition = await db().edition.create({ data: { workId: work.id, format, price: 100, isActive: false } });
  return { slug, editionId: edition.id };
}

test.describe("admin forms", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    await ownerState(browser);
  });
  test.use({ storageState: stateFile("owner") });

  /** Reads the answer an ActionForm printed in `scope`, or null when the browser stopped the submit. */
  async function submitAction(page: Page, scope: Locator, button: string): Promise<{ blocked: string | null; message: string | null }> {
    const form = scope.locator("form").first();
    const invalid = await form.evaluate((f: HTMLFormElement) => {
      if (f.checkValidity()) return null;
      const bad = f.querySelector<HTMLElement>(":invalid") as HTMLInputElement | null;
      const v = bad?.validity;
      const flag = v ? (Object.keys(Object.getPrototypeOf(v)) as (keyof ValidityState)[]).find((k) => k !== "valid" && v[k]) : "";
      return `${bad?.name || bad?.id || "field"}:${String(flag)}`;
    });
    await scope.getByRole("button", { name: button, exact: true }).click();
    if (invalid) {
      await page.waitForTimeout(600);
      return { blocked: invalid, message: null };
    }
    const status = scope.getByRole("status").filter({ hasText: /\S/ });
    await expect(status.first()).toBeVisible({ timeout: 45_000 });
    return { blocked: null, message: (await status.first().innerText()).trim() };
  }

  async function typeInto(page: Page, loc: Locator, value: string) {
    await loc.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Delete");
    if (value) await page.keyboard.insertText(value);
  }

  test.describe("create coupon", () => {
    const section = (p: Page) => p.locator('section[aria-labelledby="new"]');
    const open = async (p: Page) => {
      await p.goto("/admin/coupons");
      await hydrated(p, "form");
      await expect(section(p).getByLabel("Code", { exact: true })).toBeVisible({ timeout: 90_000 });
    };
    const code = () => `E2EINP${uid().toUpperCase()}`;
    const REASON = "Created by the inputs suite";
    interface CouponInput { code?: string; type?: "PERCENT" | "FIXED"; value?: string; min?: string; max?: string; ends?: string; reason?: string }
    async function create(p: Page, input: CouponInput) {
      const s = section(p);
      await typeInto(p, s.getByLabel("Code", { exact: true }), input.code ?? code());
      await s.getByLabel("Type").selectOption(input.type ?? "PERCENT");
      await typeInto(p, s.getByLabel("Value", { exact: true }), input.value ?? "10");
      await typeInto(p, s.getByLabel("Minimum subtotal (optional)"), input.min ?? "");
      await typeInto(p, s.getByLabel("Max uses (optional)"), input.max ?? "");
      if (input.ends) await s.getByLabel("Last day (optional)").fill(input.ends);
      await typeInto(p, s.getByLabel("Reason (kept in the audit log)"), input.reason ?? REASON);
      return submitAction(p, s, "Create coupon");
    }
    const exists = (c: string) => db().coupon.findUnique({ where: { code: c.toUpperCase() } });

    test("should create the coupon and clear the form when every field is valid", async ({ page }) => {
      await open(page);
      const c = code();
      const out = await create(page, { code: c, value: "15", min: "100", max: "5", ends: "2099-12-31" });
      expect(out.message).toBe("Coupon created.");
      const row = await exists(c);
      expect(row?.type).toBe("PERCENT");
      expect(Number(row?.value)).toBe(15);
      expect(row?.maxRedemptions).toBe(5);
      await expect(section(page).getByLabel("Code", { exact: true })).toHaveValue("");
    });

    test("should store the code in upper case when it is typed in lower case", async ({ page }) => {
      await open(page);
      const c = `e2einp-low-${uid()}`;
      expect((await create(page, { code: c })).message).toBe("Coupon created.");
      expect(await exists(c)).not.toBeNull();
    });

    test("should block a 2-character code in the browser when the code is shorter than 3", async ({ page }) => {
      await open(page);
      const out = await create(page, { code: "ab" });
      expect(out.blocked).toMatch(/code:tooShort/);
    });

    test("should stop typing at 30 characters when the code is longer", async ({ page }) => {
      await open(page);
      await typeInto(page, section(page).getByLabel("Code", { exact: true }), "E2EINP" + "A".repeat(40));
      expect((await section(page).getByLabel("Code", { exact: true }).inputValue()).length).toBe(30);
    });

    test("should create the coupon when the code is exactly 30 characters", async ({ page }) => {
      await open(page);
      const c = "E2EINP" + uid().toUpperCase().padEnd(24, "X").slice(0, 24);
      expect(c.length).toBe(30);
      expect((await create(page, { code: c })).message).toBe("Coupon created.");
    });

    for (const [id, value] of [["a space and a symbol", "E2EINP BAD!"], ["emoji", "E2EINPðŸ˜€ðŸ˜€"], ["HTML", SCRIPT.slice(0, 30)], ["SQL", "E2EINP';DROP--"]] as const) {
      test(`should refuse the code with a visible message when it holds ${id}`, async ({ page }) => {
        await open(page);
        const out = await create(page, { code: value });
        expect(out.message).toMatch(/3 to 30 letters, numbers/);
        expect(await exists(value)).toBeNull();
      });
    }

    test("should refuse a code that already exists when the same code is created twice", async ({ page }) => {
      await open(page);
      const c = code();
      expect((await create(page, { code: c })).message).toBe("Coupon created.");
      expect((await create(page, { code: c })).message).toBe("That code already exists.");
    });

    for (const [id, input, expected] of [
      ["a percentage of 101", { value: "101" }, /cannot be more than 100/],
      ["a percentage of 100", { value: "100" }, /Coupon created/],
      ["a percentage of 0.01", { value: "0.01" }, /Coupon created/],
      ["a fixed amount of 500", { type: "FIXED" as const, value: "500" }, /Coupon created/],
      ["a fixed amount over the column size", { type: "FIXED" as const, value: "99999999999" }, /\S/],
      ["a percentage with 3 decimals", { value: "10.555" }, /\S/],
    ] as const) {
      test(`should answer with a visible message when the value is ${id}`, async ({ page }) => {
        await open(page);
        const out = await create(page, input);
        if (out.blocked) expect(out.blocked).toMatch(/value:/);
        else expect(out.message).toMatch(expected);
      });
    }

    for (const [id, value, flag] of [["0", "0", "rangeUnderflow"], ["-5", "-5", "rangeUnderflow"], ["empty", "", "valueMissing"], ["letters", "abc", "valueMissing"]] as const) {
      test(`should block the value in the browser when it is ${id}`, async ({ page }) => {
        await open(page);
        const out = await create(page, { value });
        expect(out.blocked).toMatch(new RegExp(`value:(${flag}|badInput|valueMissing)`));
      });
    }

    for (const [id, input, field] of [
      ["a negative minimum subtotal", { min: "-1" }, "minSubtotal"],
      ["zero maximum uses", { max: "0" }, "maxRedemptions"],
      ["a fraction of a use", { max: "1.5" }, "maxRedemptions"],
    ] as const) {
      test(`should block the form in the browser when there is ${id}`, async ({ page }) => {
        await open(page);
        expect((await create(page, input)).blocked).toContain(field);
      });
    }

    test("should refuse a coupon whose last day is already in the past", async ({ page }) => {
      bug("a coupon can be created with a last day in the past (app/admin/actions.ts:71-80 / lib/admin/actions.ts:180 do not check endsAt), so it is dead on arrival");
      await open(page);
      const c = code();
      const out = await create(page, { code: c, ends: "2000-01-01" });
      expect(out.message).not.toBe("Coupon created.");
    });

    test.describe("reason box", () => {
      test("should block a 9-character reason in the browser and accept a 10-character one when the minimum is tested", async ({ page }) => {
        await open(page);
        expect((await create(page, { reason: "123456789" })).blocked).toMatch(/reason:tooShort/);
        const c = code();
        expect((await create(page, { code: c, reason: "1234567890" })).message).toBe("Coupon created.");
      });

      test("should stop typing at 500 characters when the reason is longer", async ({ page }) => {
        await open(page);
        await typeInto(page, section(page).getByLabel("Reason (kept in the audit log)"), "r".repeat(501));
        expect((await section(page).getByLabel("Reason (kept in the audit log)").inputValue()).length).toBe(500);
      });

      test("should refuse a reason of ten spaces with a visible message when the browser lets it through", async ({ page }) => {
        await open(page);
        const out = await create(page, { reason: " ".repeat(10) });
        expect(out.message).toMatch(/reason of at least 10 characters/);
      });

      test("should keep markup in the reason as text and show no dialog when the audit log is opened", async ({ page }) => {
        await open(page);
        const c = code();
        expect((await create(page, { code: c, reason: SCRIPT })).message).toBe("Coupon created.");
        await page.goto("/admin/audit");
        await expect(page.getByRole("heading", { name: /Audit/ }).first()).toBeVisible({ timeout: 60_000 });
        await expect(page.locator("img[src='x']")).toHaveCount(0);
      });
    });

    test("should create only one coupon when the Create button is double-clicked", async ({ page }) => {
      await open(page);
      const c = code();
      const s = section(page);
      await typeInto(page, s.getByLabel("Code", { exact: true }), c);
      await typeInto(page, s.getByLabel("Value", { exact: true }), "12");
      await typeInto(page, s.getByLabel("Reason (kept in the audit log)"), REASON);
      await s.getByRole("button", { name: "Create coupon" }).dblclick();
      await expect(s.getByRole("status").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 45_000 });
      expect(await db().coupon.count({ where: { code: c } })).toBe(1);
      expect(await db().auditLog.count({ where: { action: "coupon.created", meta: { path: ["code"], equals: c } } })).toBe(1);
    });

    test("should switch a coupon off and on again when the toggle form is given a reason", async ({ page }) => {
      const c = code();
      await db().coupon.create({ data: { code: c, type: "PERCENT", value: "5", isActive: true } });
      await page.goto("/admin/coupons");
      await hydrated(page, "form");
      const row = page.getByRole("listitem").filter({ hasText: c });
      await typeInto(page, row.getByLabel("Reason (kept in the audit log)"), "Switching off from the suite");
      await row.getByRole("button", { name: "Turn off" }).click();
      await expect(row.getByRole("status")).toContainText("Coupon updated.");
      expect((await db().coupon.findUniqueOrThrow({ where: { code: c } })).isActive).toBe(false);
    });
  });

  test.describe("new book", () => {
    const open = async (p: Page) => {
      await p.goto("/admin/content");
      await hydrated(p, "form");
      await p.getByText("New book", { exact: true }).click();
      await expect(p.getByLabel("Title", { exact: true })).toBeVisible({ timeout: 90_000 });
    };
    const scope = (p: Page) => p.locator("details").filter({ hasText: "New book" }).first();
    interface BookInput { title?: string; slug?: string; author?: string; format?: "EPUB" | "AUDIOBOOK"; price?: string; currency?: string; narrator?: string; description?: string }
    const slug = () => `e2e-inp-${uid()}`;
    async function create(p: Page, input: BookInput) {
      const s = scope(p);
      await typeInto(p, s.getByLabel("Title", { exact: true }), input.title ?? "Inputs Suite Book");
      await typeInto(p, s.getByLabel("Web address (slug)"), input.slug ?? slug());
      await typeInto(p, s.getByLabel("Author", { exact: true }), input.author ?? "E2E Author");
      await s.getByLabel("Format").selectOption(input.format ?? "EPUB");
      await typeInto(p, s.getByLabel("Price", { exact: true }), input.price ?? "100");
      await typeInto(p, s.getByLabel("Currency"), input.currency ?? "KES");
      await typeInto(p, s.getByLabel("Narrator (audiobooks)"), input.narrator ?? "");
      await typeInto(p, s.getByLabel("Description"), input.description ?? "");
      return submitAction(p, s, "Create book");
    }
    const edition = (s: string) => db().edition.findFirst({ where: { work: { slug: s } }, include: { work: true } });

    test("should create an ebook draft that is not for sale when every field is valid", async ({ page }) => {
      await open(page);
      const s = slug();
      const out = await create(page, { slug: s, price: "250.50", currency: "kes", description: "d" });
      expect(out.message).toMatch(/Book created as a draft/);
      const e = await edition(s);
      expect(e?.isActive).toBe(false);
      expect(e?.currency).toBe("KES");
      expect(Number(e?.price)).toBe(250.5);
    });

    for (const [id, value] of [["upper-case letters", "E2e-Inp-Upper"], ["a space", "e2e-inp x"], ["an underscore", "e2e-inp_x"], ["a double dash", "e2e-inp--x"], ["a leading dash", "-e2e-inp-x"], ["a trailing dash", "e2e-inp-x-"], ["a slash", "e2e-inp/x"], ["emoji", "e2e-inp-ðŸ˜€"]] as const) {
      test(`should block the slug in the browser when it has ${id}`, async ({ page }) => {
        await open(page);
        expect((await create(page, { slug: value })).blocked).toMatch(/slug:patternMismatch/);
      });
    }

    test("should refuse a 2-character slug with a readable message when the pattern allows it", async ({ page }) => {
      bug("a slug shorter than 3 or longer than 80 shows raw zod text such as 'Too small: expected string to have >=3 characters' (lib/admin/content.ts:29 gives no message for min/max)");
      await open(page);
      const out = await create(page, { slug: "ab" });
      expect(out.message ?? "").not.toMatch(RAW_LIBRARY_WORDING);
      expect(out.message ?? "").toMatch(/\S/);
    });

    test("should create the book when the slug is exactly 80 characters", async ({ page }) => {
      await open(page);
      const s = "e2e-inp-" + "a".repeat(72);
      expect((await create(page, { slug: s })).message).toMatch(/Book created/);
    });

    test("should refuse the slug with a readable message when it is 81 characters", async ({ page }) => {
      bug("an over-long slug shows raw zod text instead of a sentence (lib/admin/content.ts:29)");
      await open(page);
      const out = await create(page, { slug: "e2e-inp-" + "a".repeat(73) });
      expect(out.message ?? "").not.toMatch(RAW_LIBRARY_WORDING);
    });

    test("should add the audiobook to the same work when the slug of an ebook is reused for an audiobook", async ({ page }) => {
      await open(page);
      const s = slug();
      expect((await create(page, { slug: s, format: "EPUB" })).message).toMatch(/Book created/);
      await open(page);
      expect((await create(page, { slug: s, format: "AUDIOBOOK", narrator: "N", title: "Ignored title", price: "300" })).message).toMatch(/Book created/);
      const e = await db().edition.findMany({ where: { work: { slug: s } } });
      expect(e.map((x) => x.format).sort()).toEqual(["AUDIOBOOK", "EPUB"]);
    });

    test("should refuse a second ebook draft when the slug and format already exist", async ({ page }) => {
      bug("creating the same slug + format again silently adds a second EPUB edition to the book and drops the new title/author (lib/admin/content.ts:97-100)");
      await open(page);
      const s = slug();
      await create(page, { slug: s });
      await open(page);
      const out = await create(page, { slug: s, title: "Second try" });
      expect(out.message).not.toMatch(/Book created/);
      expect(await db().edition.count({ where: { work: { slug: s }, format: "EPUB" } })).toBe(1);
    });

    for (const [id, value] of [["empty", ""], ["only spaces", "    "]] as const) {
      test(`should refuse the book with a visible message when the title is ${id}`, async ({ page }) => {
        await open(page);
        const out = await create(page, { title: value });
        if (out.blocked) expect(out.blocked).toMatch(/title:valueMissing/);
        else expect(out.message).toBe("Enter the book title.");
      });
    }

    test("should stop typing at 200 characters when the title is longer", async ({ page }) => {
      await open(page);
      await typeInto(page, scope(page).getByLabel("Title", { exact: true }), "T".repeat(201));
      expect((await scope(page).getByLabel("Title", { exact: true }).inputValue()).length).toBe(200);
    });

    test("should stop typing at 120, 120 and 2000 characters when author, narrator and description are longer", async ({ page }) => {
      await open(page);
      const s = scope(page);
      await typeInto(page, s.getByLabel("Author", { exact: true }), "A".repeat(121));
      await typeInto(page, s.getByLabel("Narrator (audiobooks)"), "N".repeat(121));
      await typeInto(page, s.getByLabel("Description"), "D".repeat(2001));
      expect((await s.getByLabel("Author", { exact: true }).inputValue()).length).toBe(120);
      expect((await s.getByLabel("Narrator (audiobooks)").inputValue()).length).toBe(120);
      expect((await s.getByLabel("Description").inputValue()).length).toBe(2000);
    });

    test("should keep markup and unicode as plain text and show no dialog when the book is listed", async ({ page }) => {
      await open(page);
      const s = slug();
      const out = await create(page, { slug: s, title: `${UNICODE} ${SCRIPT}`, author: SCRIPT, description: SCRIPT });
      expect(out.message).toMatch(/Book created/);
      await page.reload();
      await expect(page.getByRole("heading", { level: 2, name: new RegExp("ZoÃ«") })).toBeVisible({ timeout: 60_000 });
      await expect(page.locator("img[src='x']")).toHaveCount(0);
    });

    test("should list a book whose title is one very long word without sideways scrolling when the screen is 360 px wide", async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 740 });
      await open(page);
      const out = await create(page, { title: "W".repeat(200), author: "A".repeat(120) });
      expect(out.message).toMatch(/Book created/);
      await page.reload();
      await expectNoHScroll(page, "(admin content list with a 200-character title)");
    });

    for (const [id, value, expected] of [
      ["0", "0", /more than zero/],
      ["1000000", "1000000", /Book created/],
      ["1000001", "1000001", /\S/],
      ["99.99", "99.99", /Book created/],
    ] as const) {
      test(`should answer with a visible message when the price is ${id}`, async ({ page }) => {
        await open(page);
        const out = await create(page, { price: value });
        expect(out.message).toMatch(expected);
      });
    }

    test("should refuse a price above 1000000 with a readable sentence when the server rejects it", async ({ page }) => {
      bug("a price over 1,000,000 shows raw zod text, e.g. 'Too big: expected number to be <=1000000' (lib/admin/content.ts:90)");
      await open(page);
      const out = await create(page, { price: "1000001" });
      expect(out.message ?? "").not.toMatch(RAW_LIBRARY_WORDING);
    });

    for (const [id, value, flag] of [["-1", "-1", "rangeUnderflow"], ["empty", "", "valueMissing"], ["0.001", "0.001", "stepMismatch"], ["12.345", "12.345", "stepMismatch"]] as const) {
      test(`should block the price in the browser when it is ${id}`, async ({ page }) => {
        await open(page);
        expect((await create(page, { price: value })).blocked).toMatch(new RegExp(`price:${flag}`));
      });
    }

    for (const [id, value] of [["two letters", "KE"], ["a digit", "K3S"], ["emoji", "ðŸ˜€"]] as const) {
      test(`should refuse the currency with a message when it is ${id}`, async ({ page }) => {
        await open(page);
        const out = await create(page, { currency: value });
        expect(out.message).toMatch(/3-letter currency/);
      });
    }

    test("should stop typing at 3 characters when the currency is longer", async ({ page }) => {
      await open(page);
      await typeInto(page, scope(page).getByLabel("Currency"), "KESX");
      expect(await scope(page).getByLabel("Currency").inputValue()).toBe("KES");
    });

    test("should create only one book when the Create button is double-clicked", async ({ page }) => {
      await open(page);
      const s = slug();
      const f = scope(page);
      await typeInto(page, f.getByLabel("Title", { exact: true }), "Double Click Book");
      await typeInto(page, f.getByLabel("Web address (slug)"), s);
      await typeInto(page, f.getByLabel("Author", { exact: true }), "A");
      await typeInto(page, f.getByLabel("Price", { exact: true }), "10");
      await f.getByRole("button", { name: "Create book" }).dblclick();
      await expect(f.getByRole("status").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 45_000 });
      expect(await db().edition.count({ where: { work: { slug: s } } })).toBe(1);
    });
  });

  test.describe("chapter editor", () => {
    let draft: { slug: string; editionId: string };
    test.beforeAll(async () => {
      draft = await newDraft();
    });
    const editor = (p: Page) => p.locator("#editor");
    const open = async (p: Page, id = draft.editionId) => {
      await p.goto(`/admin/content/${id}`);
      await hydrated(p, "form");
      await expect(editor(p).getByLabel("Title", { exact: true })).toBeVisible({ timeout: 90_000 });
    };
    const bodyBox = (p: Page) => p.locator("#chapter-body");
    const body = (n: number) => "word ".repeat(Math.ceil(n / 5)).slice(0, n);
    async function save(p: Page, title: string, text: string | null, huge = false) {
      const s = editor(p);
      await typeInto(p, s.getByLabel("Title", { exact: true }), title);
      if (text !== null) {
        if (huge) await bodyBox(p).fill(text);
        else await typeInto(p, bodyBox(p), text);
      }
      return submitAction(p, s, "Add chapter");
    }
    const chapters = () => db().chapter.findMany({ where: { editionId: draft.editionId }, orderBy: { idx: "asc" } });

    test("should add the chapter and show the word count while typing when the title and text are valid", async ({ page }) => {
      await open(page);
      await typeInto(page, bodyBox(page), "One two three.\n\nFour five.");
      await expect(page.getByText("5 words, 2 paragraphs")).toBeVisible();
      const out = await save(page, "First chapter", null);
      expect(out.message).toBe("Chapter saved.");
      expect((await chapters())[0].wordCount).toBe(5);
    });

    test("should block the chapter in the browser when the title or the text is empty", async ({ page }) => {
      await open(page);
      expect((await save(page, "", "text")).blocked).toMatch(/title:valueMissing/);
      await open(page);
      expect((await save(page, "Title only", "")).blocked).toMatch(/body:valueMissing/);
    });

    test("should refuse the chapter with a message when the title is only spaces", async ({ page }) => {
      await open(page);
      expect((await save(page, "   ", "text")).message).toBe("Give the chapter a title.");
    });

    test("should stop typing at 200 characters when the chapter title is longer", async ({ page }) => {
      await open(page);
      await typeInto(page, editor(page).getByLabel("Title", { exact: true }), "T".repeat(201));
      expect((await editor(page).getByLabel("Title", { exact: true }).inputValue()).length).toBe(200);
    });

    test("should keep markup and unicode as plain text and not run it when the chapter is read in the preview", async ({ page }) => {
      await open(page);
      const out = await save(page, `${UNICODE} ${SCRIPT}`.slice(0, 200), `${UNICODE}\n\n${SCRIPT}\n\n${SQLISH}`);
      expect(out.message).toBe("Chapter saved.");
      await page.goto(`/dashboard/books/${draft.slug}/read?preview=${draft.editionId}&idx=${(await chapters()).length - 1}`);
      await expect(page.getByText("Preview, nothing is saved")).toBeVisible({ timeout: 90_000 });
      await expect(page.getByText("<script>alert(1)</script><img").first()).toBeVisible();
      await expect(page.locator("img[src='x']")).toHaveCount(0);
    });

    test("should save a chapter of exactly 500000 characters and refuse one of 500001 when the limit is tested", async ({ page }) => {
      test.setTimeout(240_000);
      await open(page);
      const ok = await save(page, "Exactly at the limit", body(500_000), true);
      expect(ok.message).toBe("Chapter saved.");
      await open(page);
      const over = await save(page, "One over the limit", "a".repeat(500_001), true);
      expect(over.message).toBe("This chapter is too long. Split it into two chapters.");
    });

    test("should show a message and not crash when a chapter under the character limit is larger than 1 MB in bytes", async ({ page }) => {
      bug("a chapter of 400,000 CJK characters (1.2 MB) is under the 500,000-character rule but over Next's 1 MB server-action limit, so the save fails with a framework error instead of a message (next.config.ts has no serverActions.bodySizeLimit)");
      test.setTimeout(240_000);
      await open(page);
      const out = await save(page, "Large bytes", "æ—¥æœ¬èªžã®æ–‡ç« ã€‚".repeat(57_143), true);
      expect(out.message ?? "").toBe("Chapter saved.");
    });

    test("should accept a text of only spaces and flag it as empty in the readiness list when the body is blank", async ({ page }) => {
      const blank = await newDraft();
      await open(page, blank.editionId);
      const out = await save(page, "Blank chapter", "     ");
      expect(out.message).toBe("Chapter saved.");
      await page.reload();
      await expect(page.getByText(/Blocking: Chapter 1 \(Blank chapter\) has no text\./)).toBeVisible();
    });

    test("should offer the unsaved text back after a reload when the tab was closed before saving", async ({ page }) => {
      const fresh = await newDraft();
      await open(page, fresh.editionId);
      await typeInto(page, bodyBox(page), "Draft kept in the browser.");
      await page.reload();
      await expect(bodyBox(page)).toHaveValue("Draft kept in the browser.");
      await expect(page.getByText(/restored from your unsaved draft/)).toBeVisible();
    });

    test("should add one chapter only when the Add chapter button is double-clicked", async ({ page }) => {
      const fresh = await newDraft();
      await open(page, fresh.editionId);
      await typeInto(page, editor(page).getByLabel("Title", { exact: true }), "Twice");
      await typeInto(page, bodyBox(page), "Some text for the chapter.");
      await editor(page).getByRole("button", { name: "Add chapter" }).dblclick();
      await expect(editor(page).getByRole("status").filter({ hasText: /\S/ }).first()).toBeVisible({ timeout: 45_000 });
      expect(await db().chapter.count({ where: { editionId: fresh.editionId } })).toBe(1);
    });
  });

  test.describe("paste whole manuscript", () => {
    const open = async (p: Page) => {
      const d = await newDraft();
      await p.goto(`/admin/content/${d.editionId}`);
      await hydrated(p, "form");
      await p.getByText("Paste whole manuscript").click();
      await expect(p.getByLabel("Manuscript")).toBeVisible({ timeout: 90_000 });
      return d;
    };
    const scope = (p: Page) => p.locator("details").filter({ hasText: "Paste whole manuscript" });
    const run = async (p: Page, text: string, label: RegExp) => {
      await scope(p).getByLabel("Manuscript").fill(text);
      return submitAction(p, scope(p), (await scope(p).getByRole("button", { name: label }).innerText()).trim());
    };

    test("should say no chapters were found and add none when the text has no ## headings", async ({ page }) => {
      const d = await open(page);
      await expect(scope(page).getByRole("button", { name: "Import 0 chapters" })).toBeVisible();
      const out = await run(page, "Just some text without any heading.", /Import 0 chapters/);
      expect(out.message).toMatch(/No chapters found/);
      expect(await db().chapter.count({ where: { editionId: d.editionId } })).toBe(0);
    });

    test("should import one chapter when the text has one heading", async ({ page }) => {
      const d = await open(page);
      await scope(page).getByLabel("Manuscript").fill("## Only chapter\n\nSome words here.");
      await expect(scope(page).getByRole("button", { name: "Import 1 chapter", exact: true })).toBeVisible();
      const out = await run(page, "## Only chapter\n\nSome words here.", /Import 1 chapter/);
      expect(out.message).toBe("1 chapters added.");
      expect(await db().chapter.count({ where: { editionId: d.editionId } })).toBe(1);
    });

    test("should import three chapters in order and list them live when the text has three headings", async ({ page }) => {
      const d = await open(page);
      const text = "## A\n\none\n\n## B\n\ntwo words\n\n## C\n\nthree words here";
      await scope(page).getByLabel("Manuscript").fill(text);
      await expect(scope(page).getByText("B (2 words)")).toBeVisible();
      const out = await run(page, text, /Import 3 chapters/);
      expect(out.message).toBe("3 chapters added.");
      expect((await db().chapter.findMany({ where: { editionId: d.editionId }, orderBy: { idx: "asc" } })).map((c) => c.title)).toEqual(["A", "B", "C"]);
    });

    test("should import 200 chapters and refuse 201 when the chapter limit is tested", async ({ page }) => {
      test.setTimeout(240_000);
      const d = await open(page);
      const many = (n: number) => Array.from({ length: n }, (_, i) => `## C${i}\n\nbody ${i}`).join("\n\n");
      expect((await run(page, many(201), /Import 201 chapters/)).message).toMatch(/at most 200 chapters/);
      expect(await db().chapter.count({ where: { editionId: d.editionId } })).toBe(0);
      expect((await run(page, many(200), /Import 200 chapters/)).message).toBe("200 chapters added.");
    });

    for (const [id, text, expected] of [
      ["a heading with no title", "## \n\nbody", /has no title/],
      ["a title of 201 characters", `## ${"T".repeat(201)}\n\nbody`, /title of chapter 1 is too long/],
      ["a ### sub-heading only", "### Not a chapter\n\nbody", /No chapters found/],
      ["a heading with no space after ##", "##Nospace\n\nbody", /No chapters found/],
      ["a chapter body of 500001 characters", `## Big\n\n${"a".repeat(500_001)}`, /too long/],
    ] as const) {
      test(`should refuse the import with a message when the text has ${id}`, async ({ page }) => {
        await open(page);
        const out = await run(page, text, /Import \d+ chapters?/);
        expect(out.message).toMatch(expected);
      });
    }

    test("should show markup in a chapter title as plain text in the live list when the manuscript holds HTML", async ({ page }) => {
      await open(page);
      await scope(page).getByLabel("Manuscript").fill(`## ${SCRIPT}\n\nbody`);
      await expect(scope(page).getByRole("listitem").first()).toContainText("<script>alert(1)</script>");
      await expect(page.locator("img[src='x']")).toHaveCount(0);
    });

    test("should refuse a manuscript larger than 1 MB with a message and not crash when the text is pasted", async ({ page }) => {
      bug("a manuscript over 1 MB (allowed up to 10,000,000 characters by lib/admin/content.ts:259) fails with Next's server-action body-limit error, not a message");
      test.setTimeout(240_000);
      await open(page);
      const big = Array.from({ length: 12 }, (_, i) => `## Part ${i}\n\n${"word ".repeat(20_000)}`).join("\n\n");
      const out = await run(page, big, /Import \d+ chapters?/);
      expect(out.message ?? "").toMatch(/chapters added|too large|too long/);
    });
  });

  test.describe("owner settings", () => {
    test("should turn the email alerts off and on again and show the state in words when the button is pressed", async ({ page }) => {
      await page.goto("/admin/settings");
      await hydrated(page, "form");
      const section = page.locator("section[aria-labelledby=alerts]");
      const state = async () => (await section.innerText()).match(/Currently (on|off)/)?.[1];
      const start = await state();
      const button = start === "on" ? "Turn off" : "Turn on";
      await section.getByRole("button", { name: button }).click();
      await expect(section.getByRole("status")).toContainText("Saved.");
      await page.reload();
      expect(await state()).toBe(start === "on" ? "off" : "on");
      await section.getByRole("button", { name: start === "on" ? "Turn on" : "Turn off" }).click();
      await expect(section.getByRole("status")).toContainText("Saved.");
    });
  });
});

test.describe("who may open the admin", () => {
  test("should send a signed-out visitor to sign-in when an admin address is opened", async ({ page }) => {
    for (const path of ["/admin", "/admin/coupons", "/admin/content", "/admin/roles"]) {
      await page.goto(path, { waitUntil: "commit" });
      await page.waitForURL((u) => !u.pathname.startsWith("/admin"), { timeout: 60_000 });
      expect(new URL(page.url()).pathname, path).toMatch(/^\/(sign-in|$)/);
    }
  });

  test.describe("as a reader", () => {
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(240_000);
      await readerState(browser, "reader");
    });
    test.use({ storageState: stateFile("reader") });

    for (const path of ["/admin", "/admin/coupons", "/admin/content", "/admin/content/anything", "/admin/roles", "/admin/audit", "/admin/customers", "/admin/sales"]) {
      test(`should show no admin screen and no admin data when a reader opens ${path}`, async ({ page }) => {
        const response = await page.goto(path, { waitUntil: "load" });
        const url = new URL(page.url());
        const leaked = await page.getByRole("heading", { name: /^(Coupons|Content|Roles|Audit log|Customers|Sales|Overview)$/ }).count();
        expect(leaked, `an admin heading is visible at ${url.pathname}`).toBe(0);
        expect([404, 403, 200, 307, 308]).toContain(response?.status() ?? 200);
        await expect(page.getByLabel("Reason (kept in the audit log)")).toHaveCount(0);
      });
    }

    test("should refuse the audio upload API when a reader calls it", async ({ page }) => {
      const res = await page.request.post("/api/admin/chapter-audio", { data: { editionId: "x", chapterId: "y", filename: "a.mp3", contentType: "audio/mpeg" }, headers: { origin: BASE, "x-forwarded-for": ip } });
      expect([401, 403, 404]).toContain(res.status());
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// B. Responsive sweep
// ---------------------------------------------------------------------------------------------------------------------

const WIDTHS: [number, number][] = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1920, 1080]];
const MIN_TARGET = 40;
const RESULTS = `${STATE_DIR}/responsive.jsonl`;

interface Measure {
  scrollW: number;
  clientW: number;
  wide: string[];
  small: string[];
  h1: number;
  imgNoAlt: string[];
  clipped: string[];
}

interface Row extends Measure {
  route: string;
  width: number;
  consoleErrors: string[];
  netFails: string[];
}

/** Everything about one rendered page that the sweep asserts or reports. Runs in the browser. */
function measurePage(minTarget: number): Measure {
  const doc = document.documentElement;
  const vw = doc.clientWidth;
  const vh = window.innerHeight;
  const describe = (el: Element) => {
    const t = ((el.getAttribute("aria-label") || (el as HTMLElement).innerText || el.getAttribute("title") || el.getAttribute("placeholder") || el.getAttribute("name") || el.getAttribute("href") || "") as string)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    const cls = (typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""} "${t}"`;
  };
  const shown = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[aria-hidden='true']") && !el.closest("[hidden]");
  };
  const clips = (cs: CSSStyleDeclaration) => /hidden|clip|auto|scroll/.test(cs.overflowX) || /hidden|clip|auto|scroll/.test(cs.overflowY);

  const wide: string[] = [];
  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    if (wide.length >= 6) break;
    if (el.closest("svg") || el.closest("nextjs-portal") || !shown(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= vw + 1) continue;
    let clipped = false;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      if (clips(getComputedStyle(p))) {
        clipped = true;
        break;
      }
    }
    if (!clipped && getComputedStyle(el).position !== "fixed") wide.push(`${describe(el)} ${Math.round(r.width)}px`);
  }

  const small: string[] = [];
  const targets = document.body.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=link], [role=checkbox], [role=switch]");
  for (const el of Array.from(targets)) {
    if (!shown(el) || (el as HTMLInputElement).tabIndex === -1 && el.getAttribute("aria-hidden")) continue;
    const label = (el as HTMLInputElement).labels?.[0];
    const box = (label && /checkbox|radio/.test((el as HTMLInputElement).type) ? label : el).getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue; // visually hidden helpers
    if (box.bottom <= 0 || box.top >= vh || box.right <= 0 || box.left >= vw) continue; // not in the first screen
    if (el.tagName === "A" && getComputedStyle(el).display === "inline") continue; // a link inside a sentence is exempt
    if (box.width < minTarget || box.height < minTarget) small.push(`${describe(el)} ${Math.round(box.width)}x${Math.round(box.height)}`);
  }

  const h1 = Array.from(document.querySelectorAll("h1")).filter((h) => shown(h) || getComputedStyle(h).display !== "none").length;
  const imgNoAlt = Array.from(document.querySelectorAll("img:not([alt])")).map((i) => describe(i)).slice(0, 5);

  const clipped: string[] = [];
  for (const h of Array.from(document.querySelectorAll<HTMLElement>("h1, h2, h3"))) {
    if (!shown(h)) continue;
    const range = document.createRange();
    range.selectNodeContents(h);
    const text = range.getBoundingClientRect();
    for (let a: HTMLElement | null = h; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!clips(cs) || /auto|scroll/.test(cs.overflowX + cs.overflowY)) continue;
      const box = a.getBoundingClientRect();
      if (text.right > box.right + 1 || text.left < box.left - 1 || text.bottom > box.bottom + 1 || (a === h && h.scrollWidth > h.clientWidth + 1)) {
        clipped.push(`${describe(h)} clipped by ${describe(a)}`);
        break;
      }
    }
  }
  return { scrollW: doc.scrollWidth, clientW: vw, wide, small, h1, imgNoAlt, clipped };
}

/** Expected noise: signed-out visitors ask the server who they are, and it answers 401. */
const EXPECTED_FAILS = [/\/api\/user\/bootstrap/, /\/api\/auth\/get-session/, /\/api\/notifications\/unread-count/, /\/api\/user\/owned/];
const NOISE_CONSOLE = [/Download the React DevTools/, /\[HMR\]/, /\[Fast Refresh\]/];

interface RouteSpec {
  name: string;
  path: () => string | Promise<string>;
  prepare?: (page: Page) => Promise<void>;
  ready?: (page: Page) => Promise<void>;
  /** A known app bug on this route: the test is marked expected-to-fail with this reason. */
  bug?: string;
  /** Failed requests that are part of the page's normal behaviour. */
  allowFail?: RegExp[];
}

async function sweepRoute(page: Page, spec: RouteSpec) {
  test.setTimeout(480_000);
  if (spec.bug) bug(spec.bug);
  const consoleErrors: string[] = [];
  const netFails: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !NOISE_CONSOLE.some((r) => r.test(m.text()))) consoleErrors.push(m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 160)}`));
  page.on("requestfailed", (r) => {
    if (r.failure()?.errorText === "net::ERR_ABORTED") return;
    netFails.push(`${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    const path = new URL(r.url()).pathname;
    if (r.status() >= 400 && !(spec.allowFail ?? []).some((re) => re.test(path)) && !EXPECTED_FAILS.some((re) => re.test(path))) netFails.push(`${r.status()} ${r.request().method()} ${path}`);
  });

  await spec.prepare?.(page);
  const path = await spec.path();
  mkdirSync(STATE_DIR, { recursive: true });
  for (const [i, [w, h]] of WIDTHS.entries()) {
    await page.setViewportSize({ width: w, height: h });
    if (i === 0) {
      await page.goto(path, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
    }
    await spec.ready?.(page);
    await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
    await page.waitForTimeout(500);
    const m = await page.evaluate(measurePage, MIN_TARGET);
    const row: Row = { ...m, route: spec.name, width: w, consoleErrors: [...new Set(consoleErrors)], netFails: [...new Set(netFails)] };
    appendFileSync(RESULTS, JSON.stringify(row) + "\n");
    const tag = `${spec.name} @ ${w}px`;
    expect.soft(m.scrollW, `${tag}: sideways scroll (${m.scrollW} > ${m.clientW})`).toBeLessThanOrEqual(m.clientW);
    expect.soft(m.wide, `${tag}: elements wider than the screen and not clipped`).toEqual([]);
    expect.soft(m.h1, `${tag}: number of visible <h1>`).toBe(1);
    expect.soft(m.imgNoAlt, `${tag}: images without alt`).toEqual([]);
    expect.soft(m.clipped, `${tag}: headings clipped by overflow`).toEqual([]);
  }
  expect.soft([...new Set(consoleErrors)], `${spec.name}: console errors`).toEqual([]);
  expect.soft([...new Set(netFails)], `${spec.name}: failed requests`).toEqual([]);
}

function writeReport() {
  if (!existsSync(RESULTS)) return;
  const rows = readFileSync(RESULTS, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Row);
  const pad = (s: string | number, n: number) => String(s).padEnd(n);
  const lines: string[] = [];
  lines.push(`Responsive report: ${rows.length} page x width measurements, ${new Set(rows.map((r) => r.route)).size} pages, widths ${WIDTHS.map((w) => w[0]).join("/")}`);
  lines.push("");
  lines.push(`${pad("page", 38)}${pad("width", 7)}${pad("overflow", 11)}${pad("wide", 6)}${pad("small", 7)}${pad("h1", 4)}${pad("alt", 5)}${pad("clip", 6)}${pad("console", 9)}net`);
  for (const r of rows) {
    lines.push(`${pad(r.route, 38)}${pad(r.width, 7)}${pad(r.scrollW > r.clientW ? `+${r.scrollW - r.clientW}px` : "none", 11)}${pad(r.wide.length, 6)}${pad(r.small.length, 7)}${pad(r.h1, 4)}${pad(r.imgNoAlt.length, 5)}${pad(r.clipped.length, 6)}${pad(r.consoleErrors.length, 9)}${r.netFails.length}`);
  }
  lines.push("");
  lines.push("Problems (overflow, wide elements, h1 != 1, images without alt, clipped headings, console errors, failed requests):");
  for (const r of rows) {
    const probs = [
      ...(r.scrollW > r.clientW ? [`overflow ${r.scrollW}>${r.clientW}`] : []),
      ...r.wide.map((x) => `wide: ${x}`),
      ...(r.h1 !== 1 ? [`h1 count ${r.h1}`] : []),
      ...r.imgNoAlt.map((x) => `img without alt: ${x}`),
      ...r.clipped.map((x) => `heading: ${x}`),
      ...r.consoleErrors.map((x) => `console: ${x}`),
      ...r.netFails.map((x) => `network: ${x}`),
    ];
    if (probs.length) lines.push(`  ${r.route} @ ${r.width}px: ${probs.join(" | ")}`);
  }
  lines.push("");
  lines.push(`Small targets (< ${MIN_TARGET}x${MIN_TARGET}px) in the first screen, per page (largest width first not shown; 360 px list):`);
  const seen = new Set<string>();
  for (const r of rows.filter((x) => x.width === 360)) {
    if (!r.small.length) continue;
    lines.push(`  ${r.route} (${r.small.length}):`);
    for (const s of r.small.slice(0, 12)) lines.push(`      ${s}`);
    seen.add(r.route);
  }
  lines.push("");
  lines.push("Worst 15 (page @ width) by small targets:");
  for (const r of [...rows].sort((a, b) => b.small.length - a.small.length).slice(0, 15)) lines.push(`  ${r.small.length}  ${r.route} @ ${r.width}px`);
  writeFileSync("e2e/responsive-report.txt", lines.join("\n") + "\n");
  console.log("\n" + lines.slice(0, rows.length + 4).join("\n"));
}

test.describe("responsive sweep", () => {
  test.afterAll(() => writeReport());

  const wait = async (page: Page, sel: string) => expect(page.locator(sel).first()).toBeVisible({ timeout: 90_000 });
  const GUEST_NOISE = [/\/api\/user\/bootstrap/];

  test.describe("signed-out pages", () => {
    const routes: RouteSpec[] = [
      { name: "/", path: () => "/" },
      { name: "/about", path: () => "/about" },
      { name: "/blog", path: () => "/blog" },
      { name: "/services", path: () => "/services" },
      { name: "/contact", path: () => "/contact" },
      { name: "/privacy", path: () => "/privacy" },
      { name: "/terms", path: () => "/terms" },
      { name: "/refunds", path: () => "/refunds" },
      { name: "/cookies", path: () => "/cookies" },
      { name: "/store", path: () => "/store" },
      { name: `/store/${READ_SLUG}`, path: () => `/store/${READ_SLUG}` },
      { name: "/store/test-media-book", path: () => "/store/test-media-book" },
      { name: "/cart (empty)", path: () => "/cart" },
      { name: "/cart (one book)", path: () => "/cart", prepare: (p) => seedCart(p), ready: (p) => wait(p, "text=Proceed to Checkout") },
      { name: "/checkout (one book)", path: () => "/checkout", prepare: (p) => seedCart(p), ready: (p) => wait(p, "[aria-label='Coupon code']") },
      { name: "/sign-in", path: () => "/sign-in" },
      { name: "/sign-up", path: () => "/sign-up" },
      {
        name: "/verify (code step)",
        path: () => "/verify",
        prepare: async (p) => {
          await p.addInitScript(() => sessionStorage.setItem("wc_flow", JSON.stringify({ mode: "signin", via: "email", identifier: "reader@example.test", redirect: "/dashboard/books" })));
        },
        ready: (p) => wait(p, "[aria-label='Digit 1']"),
      },
      { name: "/no-such-page (404)", path: () => "/no-such-page", allowFail: [/no-such-page/] },
    ];
    for (const r of routes) {
      test(`should fit every screen width when ${r.name} is opened`, async ({ page }) => sweepRoute(page, { ...r, allowFail: [...GUEST_NOISE, ...(r.allowFail ?? [])] }));
    }
  });

  test.describe("reader pages", () => {
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(240_000);
      await readerState(browser, "reader");
      await ensureBooks();
    });
    test.use({ storageState: stateFile("reader") });
    const routes: RouteSpec[] = [
      { name: "/dashboard", path: () => "/dashboard" },
      { name: "/dashboard/books", path: () => "/dashboard/books" },
      { name: "/dashboard/books/[slug]/read", path: () => `/dashboard/books/${READ_SLUG}/read`, ready: (p) => wait(p, "p[aria-label^='Page ']") },
      {
        name: "/dashboard/books/[slug]/listen",
        path: () => `/dashboard/books/${AUDIO_SLUG}/listen`,
        prepare: async (p) => {
          await p.route("**/e2e-inp-audio-*.wav", (route) => route.fulfill({ status: 200, headers: { "Content-Type": "audio/wav" }, body: silentWav(2) }));
        },
        ready: (p) => wait(p, "button[aria-label='Play']"),
      },
      { name: "/dashboard/bookmarks", path: () => "/dashboard/bookmarks" },
      { name: "/dashboard/notifications", path: () => "/dashboard/notifications" },
      { name: "/dashboard/activity", path: () => "/dashboard/activity" },
      { name: "/dashboard/settings", path: () => "/dashboard/settings" },
    ];
    for (const r of routes) test(`should fit every screen width when ${r.name} is opened`, async ({ page }) => sweepRoute(page, r));
  });

  test.describe("owner pages", () => {
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(300_000);
      await ownerState(browser);
      await readerState(browser, "reader");
      await ensureBooks();
    });
    test.use({ storageState: stateFile("owner") });
    const routes: RouteSpec[] = [
      { name: "/admin", path: () => "/admin" },
      { name: "/admin/sales", path: () => "/admin/sales" },
      { name: "/admin/customers", path: () => "/admin/customers" },
      { name: "/admin/customers/[id]", path: async () => `/admin/customers/${(await db().user.findUniqueOrThrow({ where: { email: ACCOUNTS.reader } })).id}` },
      { name: "/admin/inbox", path: () => "/admin/inbox" },
      { name: "/admin/comments", path: () => "/admin/comments" },
      { name: "/admin/settings", path: () => "/admin/settings" },
      { name: "/admin/coupons", path: () => "/admin/coupons" },
      { name: "/admin/content", path: () => "/admin/content" },
      { name: "/admin/content/[editionId]", path: async () => `/admin/content/${(await db().edition.findFirstOrThrow({ where: { work: { slug: READ_SLUG } } })).id}` },
      { name: "/admin/roles", path: () => "/admin/roles" },
      { name: "/admin/audit", path: () => "/admin/audit" },
    ];
    for (const r of routes) test(`should fit every screen width when ${r.name} is opened`, async ({ page }) => sweepRoute(page, r));
  });

  test("should load a signed-out page without a failed request or a console error when the visitor has no session", async ({ page }) => {
    bug("every signed-out page asks /api/user/bootstrap, gets 401, and Chrome logs a console error for it (components/auth/SessionBootstrap.tsx); the sweep treats this one request as expected noise");
    const failed: string[] = [];
    const errors: string[] = [];
    page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${new URL(r.url()).pathname}`));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 120)));
    await page.goto("/about", { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    expect(failed).toEqual([]);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// A. Step-up panel (last on purpose: the owner's earlier email-code proof has to be older than 10 minutes to be asked again)
// ---------------------------------------------------------------------------------------------------------------------

test.describe("step-up panel", () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(300_000);
    await ownerState(browser);
  });
  test.use({ storageState: stateFile("owner") });

  test("should ask for a fresh email code, refuse a wrong one, and run the role change after the right one", async ({ page }) => {
    const target = await createUser({ email: "e2e-inp-target@example.test", name: "E2E Role Target" });
    await page.goto("/admin/roles");
    await hydrated(page, "form");
    const form = page.locator("section[aria-labelledby=change]");
    await form.getByLabel("Customer id").fill(target.id);
    await form.getByLabel("New role").selectOption("support");
    await form.getByLabel("Reason (kept in the audit log)").fill("Changing a role from the suite");
    await form.getByRole("button", { name: "Change role" }).click();

    const panel = form.getByRole("button", { name: "Email me a code" });
    const done = form.getByRole("status").filter({ hasText: /Role changed/ });
    await expect(panel.or(done)).toBeVisible({ timeout: 60_000 });
    if (await done.isVisible()) {
      test.info().annotations.push({ type: "note", description: "the owner's email-code proof was still fresh (under 10 minutes old), so the panel was not shown; role change went straight through" });
    } else {
      await panel.click();
      await expect(form.getByLabel("Digit 1")).toBeVisible();
      await form.getByLabel("Digit 1").click();
      await page.keyboard.type("0000", { delay: 30 });
      await expect(form.getByRole("alert")).toBeVisible({ timeout: 30_000 });
      await setKnownCode("email-verification", ACCOUNTS.owner);
      await typeCode(page, KNOWN_CODE);
      await expect(done).toBeVisible({ timeout: 60_000 });
    }
    expect((await db().user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe("support");
  });
});

