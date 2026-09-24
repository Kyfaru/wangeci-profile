import type { Metadata } from "next";
import { BlogPostCard } from "@/components/marketing";
import { SectionHeading } from "@/components/ui";
import { MOCK_BLOG_POSTS } from "@/lib/mock-blog";

export const metadata: Metadata = {
  title: "Blog — Felister Wangechi Kariuki",
  description:
    "Notes on rebuilding, writing, and entrepreneurship from Felister \"Wangechi\" Kariuki.",
};

/**
 * `/blog` — catalog grid, not in the Figma file (only 4 frames were
 * designed there). Built to this project's shared design tokens, listing
 * every entry in `lib/mock-blog.ts`, newest first.
 */
export default function BlogPage() {
  const posts = [...MOCK_BLOG_POSTS].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-16 lg:px-12">
      <SectionHeading
        eyebrow="Blog"
        description="Notes on rebuilding, writing, and running a business — from the woman living it."
      >
        Stories & Lessons
      </SectionHeading>

      <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <BlogPostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
}
