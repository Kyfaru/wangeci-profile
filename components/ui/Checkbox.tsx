import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { CheckIcon } from "./icons";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  label?: ReactNode;
}

/** Custom-styled checkbox (navy check on a gold-accented box when checked). */
export function Checkbox({
  label,
  className,
  id,
  disabled,
  ...props
}: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-2.5 text-sm text-navy",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        className,
      )}
    >
      <span className="relative inline-flex size-5 shrink-0 items-center justify-center">
        <input
          type="checkbox"
          id={id}
          disabled={disabled}
          className="peer absolute inset-0 size-5 cursor-pointer appearance-none rounded-md border border-navy/25 bg-white transition-colors checked:border-gold-bright checked:bg-gold-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed"
          {...props}
        />
        <CheckIcon className="pointer-events-none relative size-3.5 text-navy opacity-0 peer-checked:opacity-100" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
