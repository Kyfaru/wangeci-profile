import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Marks the field as invalid — pairs with `FormField`'s error message. */
  invalid?: boolean;
}

/**
 * Base text input. Usually wrapped in `FormField` for a label + error
 * message, but usable standalone (e.g. inline search boxes).
 */
export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        "h-11 w-full rounded-xl border bg-white px-4 text-navy placeholder:text-gray",
        "transition-colors duration-150 outline-none",
        "focus:ring-2 focus:ring-offset-0",
        invalid
          ? "border-error focus:ring-error/40"
          : "border-navy/15 focus:border-navy/30 focus:ring-gold/40",
        "disabled:cursor-not-allowed disabled:bg-gray-light disabled:text-gray",
        className,
      )}
      {...props}
    />
  );
}
