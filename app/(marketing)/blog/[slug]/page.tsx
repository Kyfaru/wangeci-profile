import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { traced } from "@/lib/trace";
import { blogEnabled, sanityQuery } from "../sanity";

interface Span { text?: string }
interface Block { _type: string; style?: string; listItem?: string; children?: Span[] }
interface Post { title: string; publishedAt?: string; body?: Block[] }

const POST = `*[_type == "post" && slug.current == $slug][0]{title, publishedAt, body}`;

const getPost = (slug: string) => traced("blog.post", () => sanityQuery<Post | null>(POST, { slug }), { slug });

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const post = blogEnabled() ? await getPost(slug) : null;
  return { title: post?.title ?? "Blog" };
}

const textOf = (b: Block) => (b.children ?? []).map((c) => c.text ?? "").join("");

/** Plain Portable Text: paragraphs, headings, quotes and bullet lists. React escapes the text; nothing is raw HTML. */
function Body({ blocks }: { blocks: Block[] }) {
  const out: React.ReactNode[] = [];
  let items: React.ReactNode[] = [];
  const flush = () => {
    if (items.length) out.push(<ul key={`ul-${out.length}`} className="my-4 list-disc pl-6">{items}</ul>);
    items = [];
  };
  blocks.forEach((b, i) => {
    if (b._type !== "block") return; // images and custom blocks are not rendered
    if (b.listItem) return void items.push(<li key={i}>{textOf(b)}</li>);
    flush();
    if (b.style === "h2" || b.style === "h3") out.push(<h2 key={i} className="mt-8 font-display text-2xl text-navy">{textOf(b)}</h2>);
    else if (b.style === "blockquote") out.push(<blockquote key={i} className="my-4 border-l-4 border-gold pl-4 italic">{textOf(b)}</blockquote>);
    else out.push(<p key={i} className="my-4">{textOf(b)}</p>);
  });
  flush();
  return <>{out}</>;
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  if (!blogEnabled()) notFound();
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 text-navy/80">
      <h1 className="font-display text-4xl text-navy">{post.title}</h1>
      {post.publishedAt && <p className="mt-2 text-sm text-navy/50">{post.publishedAt.slice(0, 10)}</p>}
      <div className="mt-6"><Body blocks={post.body ?? []} /></div>
    </article>
  );
}
