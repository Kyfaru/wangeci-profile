import { cn } from "@/lib/cn";

/**
 * SVG from public/icons drawn as a CSS mask so it follows `currentColor`
 * (`size` in px, or any CSS length such as a clamp(); colour with a text class, e.g. `text-gold`).
 */
export function MaskIcon({ name, size = 22, className }: { name: string; size?: number | string; className?: string }) {
  const url = `url(/icons/${name}.svg)`;
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        width: size,
        height: size,
        maskImage: url,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: url,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  );
}
