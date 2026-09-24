import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarIcon } from "@/components/marketing/icons";
import { Card } from "@/components/ui";
import { findBlogPostBySlug, MOCK_BLOG_POSTS } from "@/lib/mock-blog";

export function generateStaticParams() {
  return MOCK_BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = findBlogPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — Felister Wangechi Kariuki`,
    description: post.excerpt,
  };
}

function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * `/blog/[slug]` — article detail. Prose/typography styling matches
 * `app/(marketing)/store/[slug]/page.tsx`'s excerpt-card convention: a
 * `Card` with `font-display` headings and `whitespace-pre-line` body copy,
 * rather than a separate markdown/prose stack.
 */
export default async function BlogPostPage({
  params,
}: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const post = findBlogPostBySlug(slug);

  if (!post) notFound();

  return (
    <article className="mx-auto w-full max-w-[820px] px-6 py-16 lg:px-12">
      <Link
        href="/blog"
        className="text-sm font-medium text-navy/60 transition-colors hover:text-navy"
      >
        &larr; Back to Blog
      </Link>

      <header className="mt-6 flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium tracking-wide text-navy uppercase"
            >
              {tag.replace(/-/g, " ")}
            </span>
          ))}
        </div>

        <h1 className="font-display text-4xl leading-tight text-navy sm:text-5xl">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray">
          <span className="font-medium text-navy/80">{post.author}</span>
          <span aria-hidden="true">&middot;</span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-3.5" />
            {formatPublishedDate(post.publishedAt)}
          </span>
          <span aria-hidden="true">&middot;</span>
          <span>{post.readTimeMinutes} min read</span>
        </div>
      </header>

      {/* Cover placeholder — no real cover asset exists yet; see
          `post.coverImage` in lib/mock-blog.ts for the eventual asset path. */}
      <div className="relative mt-10 aspect-16/9 w-full overflow-hidden rounded-card bg-linear-to-br from-navy to-navy/80">
        <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
          <span className="font-display text-2xl leading-snug text-cream">
            {post.title}
          </span>
        </div>
      </div>

      <Card padding="lg" className="mt-10">
        <p className="text-lg leading-relaxed text-navy/90 italic">
          {post.excerpt}
        </p>
        <div className="my-6 h-px w-full bg-navy/10" />
        <p className="text-base leading-relaxed whitespace-pre-line text-navy/80">
          {post.content}
        </p>
      </Card>
    </article>
  );
}
