// Publish a book edition from local files: creates the Work, Edition, Chapters and Assets, uploads
// files to Cloudflare R2, and (with --activate) makes the edition buyable.
//
//   node --env-file=.env.local scripts/publish-edition.ts <manifest.json> [--dry-run] [--no-upload] [--activate] [--yes]
//
//   --dry-run     check the manifest and files, write nothing
//   --no-upload   write the database rows but skip R2 (local testing)
//   --activate    set the edition live (default: created inactive, so nothing is sold by accident)
//   --yes         required when DATABASE_URL is not on localhost (you are touching a shared database)
//
// See scripts/examples/memoir-ebook.json and docs/PUBLISHING.md for the manifest format.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const manifestPath = args.find((a) => !a.startsWith("--"));
const flag = (name: string) => args.includes(`--${name}`);
if (!manifestPath) {
  console.error("Usage: node --env-file=.env.local scripts/publish-edition.ts <manifest.json> [--dry-run] [--no-upload] [--activate] [--yes]");
  process.exit(1);
}

interface Manifest {
  work: { slug: string; title: string; author: string; description?: string };
  edition: { id?: string; format: "EPUB" | "AUDIOBOOK"; title?: string; price: number; currency?: string; narrator?: string };
  cover?: string;
  chapters: { title: string; file?: string; audio?: string; durationSeconds?: number; isFreePreview?: boolean }[];
}

const baseDir = path.dirname(path.resolve(manifestPath));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
const abs = (p: string) => path.resolve(baseDir, p);
const fail = (msg: string): never => {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
};

// ---- 1. Validate everything before touching anything ----
const { work, edition, chapters } = manifest;
if (!work?.slug || !work.title || !work.author) fail("work.slug, work.title and work.author are required");
if (!["EPUB", "AUDIOBOOK"].includes(edition?.format)) fail('edition.format must be "EPUB" or "AUDIOBOOK"');
if (!(edition.price > 0)) fail("edition.price must be greater than 0");
if (!Array.isArray(chapters) || chapters.length === 0) fail("chapters must not be empty");

const warnings: string[] = [];
chapters.forEach((c, i) => {
  if (!c.title) fail(`chapter ${i + 1}: title is required`);
  if (edition.format === "EPUB") {
    if (!c.file || !fs.existsSync(abs(c.file))) fail(`chapter ${i + 1}: text file not found (${c.file})`);
    if (!fs.readFileSync(abs(c.file!), "utf8").trim()) fail(`chapter ${i + 1}: text file is empty`);
  } else {
    if (!c.audio || !fs.existsSync(abs(c.audio))) fail(`chapter ${i + 1}: audio file not found (${c.audio})`);
    if (c.file && !fs.existsSync(abs(c.file))) fail(`chapter ${i + 1}: text file not found (${c.file})`); // optional read-along text
    if (!/\.(mp3|m4a)$/i.test(c.audio!)) fail(`chapter ${i + 1}: audio must be .mp3 or .m4a`);
    if (!(c.durationSeconds && c.durationSeconds > 0)) fail(`chapter ${i + 1}: durationSeconds is required`);
    // Optional check: the files should be 192-320 kbps. Needs ffprobe on the PATH; skipped if missing.
    try {
      const kbps = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=bit_rate", "-of", "default=nw=1:nk=1", abs(c.audio!)], { encoding: "utf8" }).trim()) / 1000;
      if (kbps < 190 || kbps > 325) warnings.push(`chapter ${i + 1}: bitrate is ${Math.round(kbps)} kbps (expected 192-320)`);
    } catch {
      /* ffprobe not installed: bitrate not checked */
    }
  }
});
if (manifest.cover && !fs.existsSync(abs(manifest.cover))) fail(`cover file not found (${manifest.cover})`);
if (edition.format === "AUDIOBOOK") warnings.push("Reminder: use constant-bitrate files with the index at the start (ffmpeg -movflags +faststart for m4a) so seeking is exact.");

const dbUrl = new URL(process.env.DATABASE_URL ?? "postgresql://missing");
console.log(`Database host: ${dbUrl.hostname}`);
if (!["localhost", "127.0.0.1"].includes(dbUrl.hostname) && !flag("yes")) fail("DATABASE_URL is not local. Re-run with --yes if you really mean it.");
warnings.forEach((w) => console.warn(`WARNING: ${w}`));
console.log(`Plan: ${work.title} / ${edition.format} / ${chapters.length} chapters / ${edition.currency ?? "KES"} ${edition.price}${flag("activate") ? " / ACTIVATE" : " / inactive"}`);
if (flag("dry-run")) {
  console.log("Dry run: nothing written.");
  process.exit(0);
}

// ---- 2. Write ----
const prisma = new PrismaClient();
const upload = !flag("no-upload");
const r2 = upload
  ? new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    })
  : null;

const mime = (file: string) => ({ ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" })[path.extname(file).toLowerCase()] ?? "application/octet-stream";

async function put(bucket: string, key: string, file: string) {
  if (!r2) return;
  await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.readFileSync(file), ContentType: mime(file) }));
}

async function main() {
  const w = await prisma.work.upsert({
    where: { slug: work.slug },
    update: { title: work.title, author: work.author, description: work.description ?? null },
    create: { slug: work.slug, title: work.title, author: work.author, description: work.description ?? null },
  });

  const data = { workId: w.id, format: edition.format, title: edition.title ?? null, narrator: edition.narrator ?? null, price: edition.price.toFixed(2), currency: edition.currency ?? "KES" };
  const e = edition.id
    ? await prisma.edition.update({ where: { id: edition.id }, data })
    : await prisma.edition.create({ data: { ...data, isActive: false } });

  if (manifest.cover) {
    const key = `covers/${work.slug}${path.extname(manifest.cover).toLowerCase()}`;
    await put(process.env.R2_BUCKET_PUBLIC!, key, abs(manifest.cover));
    await prisma.asset.deleteMany({ where: { editionId: e.id, kind: "COVER_IMAGE" } });
    await prisma.asset.create({ data: { editionId: e.id, kind: "COVER_IMAGE", bucket: upload ? process.env.R2_BUCKET_PUBLIC! : "local", key: upload ? key : `/${manifest.cover}`, mimeType: mime(manifest.cover), sizeBytes: fs.statSync(abs(manifest.cover)).size } });
  }

  for (const [idx, c] of chapters.entries()) {
    let body: string | null = null;
    let assetId: string | null = null;
    let wordCount = 0;
    if (edition.format === "EPUB") {
      body = fs.readFileSync(abs(c.file!), "utf8").replace(/\r\n/g, "\n").trim();
      wordCount = body.split(/\s+/).length;
    } else {
      // Optional text for the read-along view (shown while the narrator speaks).
      if (c.file) {
        body = fs.readFileSync(abs(c.file), "utf8").replace(/\r\n/g, "\n").trim();
        wordCount = body.split(/\s+/).length;
      }
      const ext = path.extname(c.audio!).toLowerCase();
      const key = `editions/${e.id}/audio/${String(idx).padStart(3, "0")}${ext}`;
      await put(process.env.R2_BUCKET_PROTECTED!, key, abs(c.audio!)); // protected bucket: never public
      const asset = await prisma.asset.create({ data: { editionId: e.id, kind: "AUDIO_FILE", bucket: process.env.R2_BUCKET_PROTECTED!, key, mimeType: mime(c.audio!), sizeBytes: fs.statSync(abs(c.audio!)).size } });
      assetId = asset.id;
    }
    await prisma.chapter.upsert({
      where: { editionId_idx: { editionId: e.id, idx } },
      update: { title: c.title, body, wordCount, assetId, durationSeconds: c.durationSeconds ?? null, isFreePreview: Boolean(c.isFreePreview) },
      create: { editionId: e.id, idx, title: c.title, body, wordCount, assetId, durationSeconds: c.durationSeconds ?? null, isFreePreview: Boolean(c.isFreePreview) },
    });
  }

  if (edition.format === "AUDIOBOOK") {
    await prisma.edition.update({ where: { id: e.id }, data: { durationSeconds: chapters.reduce((n, c) => n + (c.durationSeconds ?? 0), 0) } });
  }
  if (flag("activate")) await prisma.edition.update({ where: { id: e.id }, data: { isActive: true } });

  console.log(`Done. Edition id: ${e.id} (${flag("activate") ? "ACTIVE" : "inactive; re-run with --activate and \"edition.id\" in the manifest to go live"})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
