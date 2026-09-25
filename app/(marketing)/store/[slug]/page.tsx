import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { BookToc } from "@/components/store/BookToc";
import { BuyButtons } from "@/components/store/BuyButtons";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { BOOK_PREVIEWS, DEFAULT_PREVIEW } from "@/lib/content/book-preview";
import { findBookBySlug, MOCK_BOOKS } from "@/lib/mock-books";

export function generateStaticParams() {
  return MOCK_BOOKS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/store/[slug]">): Promise<Metadata> {
  const book = findBookBySlug((await params).slug);
  if (!book) return {};
  return { title: `${book.title} — Felister Wangechi Kariuki`, description: book.description };
}

// Chips are sized in em and the row's font-size follows the width of its column (cqw, capped at
// the Figma 13px), so the whole chip - height, padding, icon, gaps - scales together and the
// duration + rating chips stay on one row from very small phones up.
const chip = "flex h-[3.2em] items-center gap-[0.9em] rounded-full bg-white/15 px-[0.85em] font-medium text-white";
const chipIcon = "1.9em";

/** `/store/[slug]` — Book Preview (Figma "Book Preview" frame). */
export default async function BookPreviewPage({ params }: PageProps<"/store/[slug]">) {
  const book = findBookBySlug((await params).slug);
  if (!book) notFound();

  const preview = BOOK_PREVIEWS[book.slug] ?? DEFAULT_PREVIEW;
  const ebook = book.editions.find((e) => e.format === "ebook");
  const audio = book.editions.find((e) => e.format === "audiobook");
  const hasToc = preview.sections.length > 0;

  return (
    <div className="bg-[linear-gradient(102deg,#0C2142_10.3%,#0F4FB1_187.28%)]">
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
            <h1 className="mb-[calc(54px_-_0.125em)] mt-5 font-display text-[clamp(2.5rem,13.5vw,3.25rem)] font-normal md:text-[clamp(4rem,9vw,6rem)] lg:text-[min(6rem,18.5cqw)] leading-[0.92] tracking-[-0.02em] text-white">
              {book.title}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-[0.9em] text-[clamp(9px,3.4cqw,13px)] lg:justify-start">
              {(preview.readTime || preview.audioTime) && (
                <div className={chip}>
                  <MaskIcon name="carbon--time-filled" size={chipIcon} />
                  <span className="flex items-center gap-[0.9em]">
                    {preview.readTime}
                    {preview.readTime && preview.audioTime && (
                      // eslint-disable-next-line @next/next/no-img-element -- decorative SVG from Figma
                      <img src="/images/book-preview/line-2.svg" alt="" width={7} height={1} />
                    )}
                    {preview.audioTime}
                  </span>
                </div>
              )}
              <div className={`${chip} pr-[1.3em]`}>
                <MaskIcon name="ic--baseline-star-rate" size={chipIcon} className="text-gold-bright" />
                {book.rating} Rating
              </div>
            </div>

            <div className="mt-[54px]">
              <BuyButtons
                slug={book.slug}
                title={book.title}
                price={book.price}
                currency={book.currency}
                cover={book.cover}
                ebookEditionId={ebook?.id}
                audioEditionId={audio?.id}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Content panel */}
      <div className="rounded-t-[60px] bg-cream px-6 pb-24 pt-12 md:px-[6vw] lg:rounded-t-[110px] lg:px-[7.6vw] lg:pt-[89px]">
        <div
          className={`mx-auto grid max-w-[695px] items-start gap-10 lg:max-w-[1215px] ${hasToc ? "lg:grid-cols-[clamp(280px,29vw,420px)_minmax(0,1fr)] lg:gap-x-[calc(clamp(48px,8vw,120px)_-_5px)]" : ""}`}
        >
          {hasToc && <BookToc sections={preview.sections} />}

          <div className="min-w-0 max-w-[695px]">
            <p className="font-display text-xl leading-normal text-black xl:text-2xl">{preview.intro || book.longDescription}</p>

            {preview.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-32 pt-10 lg:pt-14">
                <h2 className="text-2xl font-bold text-black md:text-3xl xl:text-4xl">{s.title}</h2>
                <div className="mt-6 space-y-3 text-lg leading-[1.6] text-[#373737] md:text-xl xl:text-2xl">
                  {s.paragraphs.map((p) => (
                    <p key={p}>{p}</p>
                  ))}
                  {s.examples && (
                    <>
                      <p>Examples</p>
                      <ul className="list-disc ps-6 md:ps-9">
                        {s.examples.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
