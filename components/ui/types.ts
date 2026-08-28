/**
 * Shared prop types for the country/phone form primitives.
 *
 * `CountryOption` intentionally matches the shape of `lib/countries.json`
 * (owned by a parallel workstream) exactly: `{ name, iso2, dialCode, flag }`.
 * These components never import that file themselves — callers pass the
 * parsed JSON in as `countries`.
 */
export interface CountryOption {
  name: string;
  /** ISO 3166-1 alpha-2 code, e.g. "KE". Used as the option's value/key. */
  iso2: string;
  /** e.g. "+254" */
  dialCode: string;
  /** Emoji or image URL — rendered as-is. */
  flag: string;
}
