import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SpinnerIcon } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and disables the button, without changing its layout. */
  loading?: boolean;
  /** Optional icon rendered before the label. */
  icon?: ReactNode;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    "bg-navy text-cream hover:bg-navy/90 active:bg-navy/80 focus-visible:ring-gold",
  secondary:
    "bg-gold text-navy hover:bg-gold-bright active:bg-gold-bright/90 focus-visible:ring-navy",
  outline:
    "bg-transparent text-navy border border-navy hover:bg-navy/5 active:bg-navy/10 focus-visible:ring-navy",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm gap-1.5",
  md: "h-11 px-6 text-base gap-2",
  lg: "h-13 px-8 text-lg gap-2.5",
};

/**
 * Primary call-to-action button in the navy/gold palette.
 *
 * Presentational only — wire up `onClick` / form submission at the call
 * site. API calls, if any, belong outside this component.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-full font-medium tracking-tight transition-colors duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_STYLES[variant],
        SIZE_STYLES[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <SpinnerIcon className="size-4" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
}
