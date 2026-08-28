import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SectionHeadingProps {
  /** Small label shown above the heading, e.g. "ABOUT THE AUTHOR". */
  eyebrow?: ReactNode;
  children: ReactNode;
  /** Supporting copy shown below the heading. */
  description?: ReactNode;
  align?: "left" | "center";
  /** Heading element/level, defaults to "h2". */
  as?: ElementType;
  className?: string;
}

/**
 * Section title using the display font, with an optional eyebrow label
 * and supporting description. Used to open page sections consistently.
 */
export function SectionHeading({
  eyebrow,
  children,
  description,
  align = "left",
  as: Heading = "h2",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        align === "center" && "items-center text-center",
        className,
      )}
    >
      {eyebrow && (
        <span className="text-sm font-semibold tracking-[0.2em] text-gold-bright uppercase">
          {eyebrow}
        </span>
      )}
      <Heading className="font-display text-3xl leading-tight text-navy sm:text-4xl">
        {children}
      </Heading>
      {description && (
        <p className="max-w-2xl text-base text-gray">{description}</p>
      )}
    </div>
  );
}
