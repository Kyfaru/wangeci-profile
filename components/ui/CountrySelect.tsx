import { Select } from "./Select";
import type { CountryOption } from "./types";

export interface CountrySelectProps {
  /** Full country list — owned by the caller (see `lib/countries.json`). */
  countries: CountryOption[];
  /** Selected country's `iso2`. */
  value?: string;
  /** Fires with the newly selected country's `iso2`. */
  onChange?: (iso2: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * Country picker built on `Select`. Renders each country's flag inline
 * with its name; the option `value` is the country's `iso2`.
 *
 * Fully generic — does not fetch or import country data itself.
 */
export function CountrySelect({
  countries,
  value,
  onChange,
  placeholder = "Select a country",
  invalid,
  disabled,
  name,
  id,
  className,
}: CountrySelectProps) {
  return (
    <Select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      invalid={invalid}
      disabled={disabled}
      className={className}
      options={countries.map((country) => ({
        label: `${country.flag}  ${country.name}`,
        value: country.iso2,
      }))}
    />
  );
}
