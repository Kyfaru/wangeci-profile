import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** Base multi-line text input, styled to match `Input`. */
export function Textarea({
  invalid = false,
  className,
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <textarea
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full resize-y rounded-xl border bg-white px-4 py-3 text-navy placeholder:text-gray",
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
