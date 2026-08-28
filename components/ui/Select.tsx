import type { ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "./icons";

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<
    SelectHTMLAttributes<HTMLSelectElement>,
    "value" | "onChange" | "children"
  > {
  options: SelectOption[];
  value?: string;
  /** Fires with the new option's `value` (not the raw change event). */
  onChange?: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  /** Rendered inside the trigger, before the value — e.g. a flag emoji. */
  leadingElement?: ReactNode;
}

/**
 * Generic native `<select>` styled to match the rest of the form kit.
 * Consumers own the `options` data — this component has no built-in
 * country/state lists (see `CountrySelect` / `StateSelect`).
 */
export function Select({
  options,
  value,
  onChange,
  placeholder,
  invalid = false,
  leadingElement,
  className,
  disabled,
  ...props
}: SelectProps) {
  return (
    <div className={cn("relative", className)}>
      {leadingElement && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          {leadingElement}
        </span>
      )}
      <select
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border bg-white pr-10 text-navy",
          leadingElement ? "pl-10" : "pl-4",
          "transition-colors duration-150 outline-none",
          "focus:ring-2 focus:ring-offset-0",
          invalid
            ? "border-error focus:ring-error/40"
            : "border-navy/15 focus:border-navy/30 focus:ring-gold/40",
          disabled && "cursor-not-allowed bg-gray-light text-gray",
          !value && "text-gray",
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-gray" />
    </div>
  );
}
