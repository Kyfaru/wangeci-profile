import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "./icons";
import type { CountryOption } from "./types";

export interface PhoneInputProps
  extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "value" | "onChange" | "type"
  > {
  /** Full country list — owned by the caller (see `lib/countries.json`). */
  countries: CountryOption[];
  /** Selected country's `iso2`, driving the shown flag + dial code. */
  countryIso2?: string;
  /** Fires with the newly selected country's `iso2`. */
  onCountryChange: (iso2: string) => void;
  /** The local phone number, WITHOUT the dial code. */
  value: string;
  /** Fires with the new local phone number. */
  onChange: (value: string) => void;
  invalid?: boolean;
}

/**
 * Phone number input with a country-code side-select, e.g. "🇰🇪 +254 | 712 345 678".
 *
 * Fully generic — does not fetch or import country data itself. The
 * combined value (dial code + local number) is the caller's concern.
 */
export function PhoneInput({
  countries,
  countryIso2,
  onCountryChange,
  value,
  onChange,
  invalid = false,
  disabled,
  className,
  id,
  name,
  placeholder = "712 345 678",
  ...props
}: PhoneInputProps) {
  const selected = countries.find((c) => c.iso2 === countryIso2);

  return (
    <div
      className={cn(
        "flex h-11 w-full items-stretch overflow-hidden rounded-xl border bg-white",
        "transition-colors duration-150 focus-within:ring-2 focus-within:ring-offset-0",
        invalid
          ? "border-error focus-within:ring-error/40"
          : "border-navy/15 focus-within:border-navy/30 focus-within:ring-gold/40",
        disabled && "cursor-not-allowed bg-gray-light",
        className,
      )}
    >
      <div className="relative flex shrink-0 items-center border-r border-navy/10">
        <select
          aria-label="Country code"
          value={countryIso2 ?? ""}
          disabled={disabled}
          onChange={(e) => onCountryChange(e.target.value)}
          className="h-full appearance-none bg-transparent py-0 pl-3 pr-7 text-navy outline-none disabled:cursor-not-allowed disabled:text-gray"
        >
          {!selected && (
            <option value="" disabled>
              --
            </option>
          )}
          {countries.map((country) => (
            <option key={country.iso2} value={country.iso2}>
              {country.flag} {country.dialCode}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 size-3.5 text-gray" />
      </div>
      <input
        type="tel"
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-4 text-navy placeholder:text-gray outline-none disabled:cursor-not-allowed disabled:text-gray"
        {...props}
      />
    </div>
  );
}
