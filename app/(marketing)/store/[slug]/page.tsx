import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BuyButtons } from "@/components/store/BuyButtons";
import { getBookBySlug, getFreePreview } from "@/lib/catalogue";
import { jsonLd } from "@/lib/json-ld";
import { SITE } from "@/lib/site";

export const revalidate = 300; // catalogue changes rarely; refresh at most every 5 minutes

export async function generateMetadata({ params }: PageProps<"/store/[slug]">): Promise<Metadata> {
  const book = await getBookBySlug((await params).slug);
  if (!book) return {};
  const description = book.description ?? SITE.description;
  return {
    title: book.title,
    description,
    alternates: { canonical: `/store/${book.slug}` },
    openGraph: { title: book.title, description, type: "book", images: [{ url: book.cover, alt: `${book.title} cover` }] },
  };
}

/** `/store/[slug]` — Book Preview (Figma "Book Preview" frame). */
export default async function BookPreviewPage({ params }: PageProps<"/store/[slug]">) {
  const book = await getBookBySlug((await params).slug);
  if (!book) notFound();

  const preview = await getFreePreview(book.slug);
  const ebook = book.editions.find((e) => e.format === "ebook");
  const audio = book.editions.find((e) => e.format === "audiobook");

  // schema.org Book: one offer per edition, with that edition's own price.
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    image: book.cover.startsWith("http") ? book.cover : `${SITE.url}${book.cover}`,
    url: `${SITE.url}/store/${book.slug}`,
    description: book.description ?? undefined,
    workExample: book.editions.map((e) => ({
      "@type": "Book",
      bookFormat: e.format === "ebook" ? "https://schema.org/EBook" : "https://schema.org/AudiobookFormat",
      offers: { "@type": "Offer", price: e.price, priceCurrency: e.currency, availability: "https://schema.org/InStock", url: `${SITE.url}/store/${book.slug}` },
    })),
  };

  return (
    <div className="bg-[linear-gradient(102deg,#0C2142_10.3%,#0F4FB1_187.28%)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <section id="hero" className="relative isolate overflow-clip px-6 pb-16 pt-28 md:px-[6vw] md:pb-20 md:pt-36 lg:px-[7.6vw] lg:pb-[113px] lg:pt-[187px]">
        {/* Phones (no card): the circle's stage is the whole hero, behind the content, so it can travel down to the buy
            buttons. Sizes are in cqw (of this stage's width, i.e. the screen): a 120cqw circle centred 4cqw from the top
            covers both top corners with no gaps. From md up the circle lives in the cover card instead (below). */}
        <div aria-hidden className="orb-x orb-m @container absolute inset-0 -z-10 md:hidden">
          <div className="orb-y absolute inset-0">
            <div className="cover-orb absolute -left-[10cqw] -top-[56cqw] aspect-square w-[120cqw] rounded-full bg-white/10" />
          </div>
        </div>
        <div className="mx-auto grid max-w-[1215px] items-center gap-y-2 md:gap-y-8 lg:grid-cols-[477px_minmax(0,1fr)] lg:gap-x-[104px]">
          {/* Cover card */}
          <div className="relative mx-auto aspect-[477/620] w-full max-w-[477px] md:overflow-hidden md:rounded-[37px] md:bg-[rgb(12_58_130/0.64)]">
            {/* Figma "Ellipse 1": 505px circle at (238.5, 95.5) in the 477x620 card, white @ 10%, clipped by the card.
                Wrappers = stage layers so x / y / size can each run their own CSS animation (see .cover-orb in globals.css). */}
            <div aria-hidden className="orb-x absolute inset-0 hidden md:block">
              <div className="orb-y absolute inset-0">
                <div className="cover-orb absolute -left-[2.94%] -top-[25.32%] aspect-square w-[105.87%] rounded-full bg-white/10" />
              </div>
            </div>
            <div className="absolute left-[14.9%] top-[13.5%] aspect-[334.7/473] w-[70.2%] overflow-hidden rounded-[20px]">
              <Image src={book.cover} alt={`${book.title} cover`} fill preload sizes="(min-width: 768px) 335px, 70vw" className="object-cover" />
            </div>
          </div>

          <div className="@container min-w-0 text-center lg:text-left">
            <p className="text-xl font-medium text-[#989898] md:text-2xl">{book.author}</p>
            {/* mb: 54px visible gap to the chips (same as chips -> buttons); 0.125em is the empty space under the letters inside the line box. */}
            <h1 className="mt-5 font-display text-[clamp(2.5rem,13.5vw,3.25rem)] font-normal md:text-[clamp(4rem,9vw,6rem)] lg:text-[min(6rem,18.5cqw)] leading-[0.92] tracking-[-0.02em] text-white">
              {book.title}
            </h1>

            <div className="mt-[54px]">
              <BuyButtons
                slug={book.slug}
                title={book.title}
                cover={book.cover}
                ebook={ebook && { id: ebook.id, price: ebook.price, currency: ebook.currency }}
                audio={audio && { id: audio.id, price: audio.price, currency: audio.currency }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content panel */}
      <div className="rounded-t-[60px] bg-cream px-6 pb-24 pt-12 md:px-[6vw] lg:rounded-t-[110px] lg:px-[7.6vw] lg:pt-[89px]">
        <div className="mx-auto max-w-[695px]">
          <h2 className="text-2xl font-bold text-black md:text-3xl">About this book</h2>
          <p className="mt-6 font-display text-xl leading-normal text-black xl:text-2xl">
            {book.description ?? (SITE.isProduction ? "" : "TODO(client): synopsis")}
          </p>

          {preview && (
            <section id="free-chapter" className="scroll-mt-32 pt-12">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold">Read the first chapter free</p>
              <h2 className="mt-3 text-2xl font-bold text-black md:text-3xl">{preview.title}</h2>
              <div className="mt-6 space-y-4 text-lg leading-[1.7] text-[#373737] md:text-xl">
                {preview.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <p className="mt-8 text-base text-black/60">Enjoying it? Buy the book above to keep reading.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
