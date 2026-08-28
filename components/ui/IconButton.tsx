import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type IconButtonVariant = "solid" | "outline" | "ghost";
export type IconButtonSize = "sm" | "md" | "lg";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  /** Required for accessibility since there's no visible label. */
  "aria-label": string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}

const VARIANT_STYLES: Record<IconButtonVariant, string> = {
  solid: "bg-navy text-cream hover:bg-navy/90 focus-visible:ring-gold",
  outline:
    "bg-transparent text-navy border border-navy/20 hover:bg-navy/5 focus-visible:ring-navy",
  ghost: "bg-transparent text-navy hover:bg-navy/5 focus-visible:ring-navy",
};

const SIZE_STYLES: Record<IconButtonSize, string> = {
  sm: "size-8 [&>svg]:size-4",
  md: "size-11 [&>svg]:size-5",
  lg: "size-14 [&>svg]:size-6",
};

/** Circular icon-only button — always pass a descriptive `aria-label`. */
export function IconButton({
  icon,
  variant = "ghost",
  size = "md",
  disabled,
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
