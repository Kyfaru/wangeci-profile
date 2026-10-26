import { rmSync } from "node:fs";

import { cleanupInputsRows, db, testDatabaseUrl } from "./db";

/**
 * Prepares the LOCAL test database: the two coupons the specs use, the test books if they are missing
 * (a fresh CI database), and removes rows left by earlier runs (every test account starts with "e2e-").
 */
export default async function globalSetup() {
  process.env.DATABASE_URL ??= testDatabaseUrl(); // also the localhost guard
  const prisma = db();

  // inputs.spec.ts keeps its signed-in browser states and responsive results here; every run starts from nothing.
  rmSync("test-results/inputs", { recursive: true, force: true });
  await cleanupInputsRows();

  const stale = { user: { email: { startsWith: "e2e-" } } };
  for (const step of [
    () => prisma.entitlement.deleteMany({ where: stale }),
    () => prisma.auditLog.deleteMany({ where: { admin: { email: { startsWith: "e2e-" } } } }),
    () => prisma.comment.deleteMany({ where: stale }),
    () => prisma.order.deleteMany({ where: stale }),
    () => prisma.user.deleteMany({ where: { email: { startsWith: "e2e-" } } }),
  ]) {
    await step().catch((e: Error) => console.warn(`[e2e] cleanup step skipped: ${e.message.split("\n").pop()}`));
  }

  for (const [code, value] of [["FREE100", 100], ["TEN", 10]] as const) {
    const data = { type: "PERCENT" as const, value, isActive: true, maxRedemptions: null, minSubtotal: null, startsAt: null, endsAt: null, description: "e2e" };
    await prisma.coupon.upsert({ where: { code }, create: { code, ...data }, update: data });
  }

  await warmUp();

  // Only created when absent; an existing (seeded) book is never changed.
  const books = [
    { slug: "from-pieces-to-power", title: "From Pieces To Power", author: "Wangeci Kariuki", editionId: "seed-edition-ebook", price: 100 },
    { slug: "test-media-book", title: "Test Media Book", author: "Wangeci Kariuki", editionId: "test-ebook", price: 50 },
  ];
  for (const b of books) {
    const work = await prisma.work.upsert({ where: { slug: b.slug }, create: { slug: b.slug, title: b.title, author: b.author }, update: {} });
    await prisma.edition.upsert({ where: { id: b.editionId }, create: { id: b.editionId, workId: work.id, format: "EPUB", price: b.price }, update: {} });
  }

  // After the whole run: remove what inputs.spec.ts created (a worker restart must not delete rows mid-run, so it is not an afterAll).
  return async () => {
    await cleanupInputsRows();
  };
}

/**
 * `next dev` compiles each route on its first hit, and the first hit can take over a minute. Visiting every
 * route the specs use once, here, keeps that cost out of the tests (and out of their timeouts).
 */
async function warmUp() {
  const base = `http://localhost:${process.env.E2E_PORT ?? 3123}`;
  const paths = [
    "/", "/checkout", "/checkout/success", "/store/test-media-book", "/sign-in", "/dashboard", "/admin", "/admin/sales",
    "/api/health", "/api/checkout", "/api/checkout/quote", "/api/community", "/api/auth/checkout/claim", "/api/orders/warm-up",
    "/api/notifications", "/api/user/owned", "/api/contact",
    "/verify", "/store", "/dashboard/settings", "/dashboard/books/warm-up/read", "/admin/content", "/admin/content/warm-up",
    "/about", "/blog", "/services", "/contact", "/privacy", "/terms", "/refunds", "/cookies", "/cart", "/sign-up", "/no-such-page",
    "/dashboard/books", "/dashboard/books/warm-up/listen", "/dashboard/bookmarks", "/dashboard/notifications", "/dashboard/activity",
    "/admin/customers", "/admin/customers/warm-up", "/admin/inbox", "/admin/comments", "/admin/settings", "/admin/coupons", "/admin/roles", "/admin/audit", "/admin/sales/warm-up",
  ];
  for (const p of paths) {
    await fetch(base + p, { redirect: "manual", signal: AbortSignal.timeout(170_000) }).catch(() => undefined);
  }
}