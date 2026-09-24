import Link from "next/link";
import { cn } from "@/lib/cn";
import { CalendarIcon } from "./icons";
import type { BlogPost } from "@/lib/mock-blog";

export interface BlogPostCardProps {
  post: BlogPost;
  className?: string;
}

function formatPublishedDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Catalog card for `/blog` — cover placeholder, title, excerpt, and a
 * meta row (date + read time), linking to the post's `/blog/[slug]` detail
 * page. Mirrors `components/store/BookCard.tsx`'s structure/placeholder
 * convention since no cover photography exists for either yet.
 */
export function BlogPostCard({ post, className }: BlogPostCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-card border border-navy/10 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md",
        className,
      )}
    >
      {/* Cover placeholder — no real cover asset exists yet; see
          `post.coverImage` in lib/mock-blog.ts for the eventual asset path. */}
      <div className="relative aspect-16/9 w-full overflow-hidden bg-linear-to-br from-navy to-navy/80">
        <div
          className="absolute -top-6 -right-6 size-24 rounded-full bg-gold-bright/25 blur-2xl"
          aria-hidden="true"
        />
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <span className="font-display text-lg leading-snug text-cream">
            {post.title}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
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

        <h3 className="font-display text-lg leading-snug text-navy transition-colors group-hover:text-gold">
          {post.title}
        </h3>
        <p className="line-clamp-3 text-sm text-gray">{post.excerpt}</p>

        <div className="mt-auto flex items-center gap-2 pt-3 text-xs text-gray">
          <CalendarIcon className="size-3.5" />
          <span>{formatPublishedDate(post.publishedAt)}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{post.readTimeMinutes} min read</span>
        </div>
      </div>
    </Link>
  );
}
