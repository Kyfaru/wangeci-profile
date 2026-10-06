import Image from "next/image";

interface ReaderRailProps {
  cover: string;
  title: string;
  author: string;
  description: string;
}

/**
 * Right info rail (Figma: "The Book" frame). Figma's overlapping double-cover
 * collage is simplified to a single cover image — not worth the mask/blur
 * complexity for a decorative flourish.
 */
export function ReaderRail({ cover, title, author, description }: ReaderRailProps) {
  return (
    <aside className="hidden w-[365px] shrink-0 flex-col border-l border-black/10 bg-white px-8 py-10 lg:flex">
      <div className="relative mx-auto aspect-[282/329] w-full max-w-[282px] overflow-hidden rounded-[20px]">
        <Image src={cover} alt={`${title} cover`} fill sizes="282px" priority className="object-cover" />
      </div>
      <h2 className="mt-8 font-display text-[28px] leading-tight text-black">{title}</h2>
      <p className="mt-1 font-medium text-gold/50">{author}</p>
      <p className="mt-6 text-[15px] leading-relaxed text-black/80">{description}</p>
    </aside>
  );
}
