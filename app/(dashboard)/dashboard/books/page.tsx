import type { Metadata } from "next";
import Link from "next/link";

import { ContinueCard } from "@/components/dashboard/ContinueCard";
import { DashboardTopbar } from "@/components/dashboard/DashboardTopbar";
import { MaskIcon } from "@/components/ui/MaskIcon";
import { BOOK_HREF } from "@/lib/content/landing";
import { cn } from "@/lib/cn";
import { getLibrary, type LibraryFormat, type LibraryStatus } from "@/lib/library";
import { requireUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "My Books" };
export const dynamic = "force-dynamic";

const FORMATS: [string, LibraryFormat | undefined][] = [["All", undefined], ["Ebooks", "ebook"], ["Audiobooks", "audiobook"]];
const STATUSES: [string, LibraryStatus | undefined][] = [["All", undefined], ["Not started", "not-started"], ["In progress", "in-progress"], ["Completed", "completed"]];

const chip = (active: boolean) => cn("rounded-full border px-4 py-1.5 text-sm transition-colors", active ? "border-navy bg-navy text-cream" : "border-black/20 text-black hover:border-navy");

/** "My dashboard" Figma frame: Continue Reading / Continue Listening, plus the whole library with filters. */
export default async function DashboardBooksPage({ searchParams }: PageProps<"/dashboard/books">) {
  const user = await requireUser();
  const sp = await searchParams;
  const format = sp.format === "ebook" || sp.format === "audiobook" ? sp.format : undefined;
  const status = sp.status === "not-started" || sp.status === "in-progress" || sp.status === "completed" ? sp.status : undefined;

  const library = await getLibrary(user.id);
  const filtered = library.filter((i) => (!format || i.format === format) && (!status || i.status === status));
  const href = (f: LibraryFormat | undefined, s: LibraryStatus | undefined) => `/dashboard/books${f || s ? `?${new URLSearchParams({ ...(f ? { format: f } : {}), ...(s ? { status: s } : {}) })}` : ""}`;

  const groups: { heading: string; icon: string; items: typeof filtered }[] = [
    { heading: "Continue Reading", icon: "fluent--reading-list-20-filled", items: filtered.filter((i) => i.format === "ebook") },
    { heading: "Continue Listening", icon: "hugeicons--audio-wave-02", items: filtered.filter((i) => i.format === "audiobook") },
  ];

  return (
    <>
      <DashboardTopbar />
      <div className="px-6 py-10 md:px-10">
        {library.length === 0 ? (
          <div>
            <h2 className="text-4xl font-medium text-black">My Books</h2>
            <p className="mt-4 text-xl text-black/70">You do not own any books yet.</p>
            <Link href={BOOK_HREF} className="mt-6 inline-block rounded-[40px] bg-navy px-8 py-3 text-lg font-medium text-cream transition-colors hover:bg-gold">
              Browse the book
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3" aria-label="Filter your library">
              <div className="flex flex-wrap gap-2">
                {FORMATS.map(([label, f]) => (
                  <Link key={label} href={href(f, status)} className={chip(f === format)} aria-current={f === format}>
                    {label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map(([label, s]) => (
                  <Link key={label} href={href(format, s)} className={chip(s === status)} aria-current={s === status}>
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {filtered.length === 0 && <p className="mt-10 text-xl text-black/70">Nothing matches those filters.</p>}

            {groups.map(
              (g) =>
                g.items.length > 0 && (
                  <section key={g.heading} className="mt-12">
                    <h2 className="flex items-center gap-3 text-3xl font-medium text-black md:text-4xl">
                      {g.heading}
                      <MaskIcon name={g.icon} size={34} />
                    </h2>
                    <div className="mt-6 flex flex-wrap gap-6">
                      {g.items.map((item, i) => (
                        <ContinueCard key={item.editionId} href={item.href} title={item.title} author={item.author} cover={item.cover} progressPercent={item.progressPercent} bookmarkCount={item.bookmarkCount} format={item.format} priority={i === 0} />
                      ))}
                    </div>
                  </section>
                ),
            )}
          </>
        )}
      </div>
    </>
  );
}
