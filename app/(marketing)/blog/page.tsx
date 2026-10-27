import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { traced } from "@/lib/trace";
import { blogEnabled, sanityQuery } from "./sanity";

export const metadata: Metadata = { title: "Blog" };

interface PostSummary {
  title: string;
  slug: string;
  publishedAt?: string;
  excerpt?: string;
}

const LIST = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc)[0...20]{title, "slug": slug.current, publishedAt, excerpt}`;

export default async function BlogPage() {
  if (!blogEnabled()) notFound();
  const posts = (await traced("blog.list", () => sanityQuery<PostSummary[]>(LIST))) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-4xl text-navy">Blog</h1>
      {posts.length === 0 ? (
        <p className="mt-6 text-navy/70">No posts yet.</p>
      ) : (
        <ul className="mt-8 space-y-6">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link href={`/blog/${p.slug}`} className="text-xl text-navy underline-offset-4 hover:underline">{p.title}</Link>
              {p.publishedAt && <p className="text-sm text-navy/50">{p.publishedAt.slice(0, 10)}</p>}
              {p.excerpt && <p className="mt-1 text-navy/70">{p.excerpt}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
