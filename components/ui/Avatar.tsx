import type { ImgHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface AvatarProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt" | "size"> {
  src?: string;
  alt: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_STYLES: Record<AvatarSize, string> = {
  xs: "size-6 text-xs",
  sm: "size-8 text-sm",
  md: "size-11 text-base",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/);
  const initials = parts.length === 1 ? parts[0]?.[0] : `${parts[0]?.[0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`;
  return (initials ?? "").toUpperCase();
}

/**
 * Circular avatar. Falls back to initials-on-navy when `src` is omitted
 * or fails to load — no image fetching/upload logic here.
 */
export function Avatar({ src, alt, size = "md", className, ...props }: AvatarProps) {
  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-full bg-navy font-medium text-cream",
          SIZE_STYLES[size],
          className,
        )}
        role="img"
        aria-label={alt}
      >
        {initialsFrom(alt)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- generic UI primitive, avoids coupling to next/image config here
    <img
      src={src}
      alt={alt}
      className={cn(
        "shrink-0 rounded-full border-2 border-white object-cover",
        SIZE_STYLES[size],
        className,
      )}
      {...props}
    />
  );
}

export interface AvatarStackProps {
  avatars: Array<{ src?: string; alt: string }>;
  size?: AvatarSize;
  /** Caps the visible avatars, showing a "+N" chip for the remainder. */
  max?: number;
  className?: string;
}

/** Overlapping row of avatars, e.g. "readers who bought this". */
export function AvatarStack({
  avatars,
  size = "sm",
  max = 4,
  className,
}: AvatarStackProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - visible.length;

  return (
    <div className={cn("flex items-center -space-x-2.5", className)}>
      {visible.map((avatar, i) => (
        <Avatar key={`${avatar.alt}-${i}`} {...avatar} size={size} />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white bg-gray-light font-medium text-navy",
            SIZE_STYLES[size],
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
