// Development seed: the memoir, two editions and placeholder chapters. All text and prices are
// obviously fake (TODO(client)). Run with: pnpm db:seed   (it is idempotent: safe to run twice).
// It refuses to run in production, and never touches anything but the database in DATABASE_URL.
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV is production.");
  process.exit(1);
}

const prisma = new PrismaClient();

const CHAPTERS = [
  { idx: 0, title: "Chapter 1 (SEED placeholder)", isFreePreview: true },
  { idx: 1, title: "Chapter 2 (SEED placeholder)", isFreePreview: false },
  { idx: 2, title: "Chapter 3 (SEED placeholder)", isFreePreview: false },
];

async function main() {
  const work = await prisma.work.upsert({
    where: { slug: "from-pieces-to-power" },
    update: {},
    create: {
      slug: "from-pieces-to-power",
      title: "From Pieces To Power",
      author: "Wangeci Kariuki",
      description: "TODO(client): real synopsis.",
    },
  });

  const ebook = await prisma.edition.upsert({
    where: { id: "seed-edition-ebook" },
    update: {},
    create: { id: "seed-edition-ebook", workId: work.id, format: "EPUB", title: "From Pieces To Power (SEED data)", price: "100.00" }, // fake price
  });
  const audio = await prisma.edition.upsert({
    where: { id: "seed-edition-audiobook" },
    update: {},
    create: { id: "seed-edition-audiobook", workId: work.id, format: "AUDIOBOOK", title: "From Pieces To Power, audiobook (SEED data)", narrator: "TODO(client)", price: "200.00", isActive: false }, // inactive until real audio exists
  });

  for (const c of CHAPTERS) {
    const wordCount = 5;
    await prisma.chapter.upsert({
      where: { editionId_idx: { editionId: ebook.id, idx: c.idx } },
      update: {},
      create: { editionId: ebook.id, ...c, wordCount, body: "TODO(client): chapter text goes here." },
    });
    await prisma.chapter.upsert({
      where: { editionId_idx: { editionId: audio.id, idx: c.idx } },
      update: {},
      create: { editionId: audio.id, idx: c.idx, title: c.title, isFreePreview: c.isFreePreview },
    });
  }

  console.log(`Seeded work "${work.title}" with 2 editions and ${CHAPTERS.length} chapters each.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
