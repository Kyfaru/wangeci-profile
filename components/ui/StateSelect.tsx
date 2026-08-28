import { Select, type SelectOption } from "./Select";

export interface StateSelectProps {
  /** State/province/region options for the currently selected country. */
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

/**
 * State/province picker built on `Select`.
 *
 * Fully generic — does not own any state/province data. The caller looks
 * up the right option list for the selected country (e.g. from
 * `lib/countries.json` or a separate states dataset) and passes it in.
 */
export function StateSelect({
  options,
  value,
  onChange,
  placeholder = "Select a state/region",
  invalid,
  disabled,
  name,
  id,
  className,
}: StateSelectProps) {
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
      options={options}
    />
  );
}
