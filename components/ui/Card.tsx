import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardPadding = "none" | "sm" | "md" | "lg";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Render as a different element, e.g. "article" or "section". */
  as?: ElementType;
  padding?: CardPadding;
  /** Adds a hover lift — use for clickable/interactive cards. */
  interactive?: boolean;
  children: ReactNode;
}

const PADDING_STYLES: Record<CardPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

/**
 * Generic rounded-card surface (per Figma's rounded-card aesthetic).
 * Purely presentational — pass any content as children.
 */
export function Card({
  as: Component = "div",
  padding = "md",
  interactive = false,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <Component
      className={cn(
        "rounded-card bg-white border border-navy/10 shadow-sm",
        interactive &&
          "transition-shadow duration-150 hover:shadow-md cursor-pointer",
        PADDING_STYLES[padding],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
