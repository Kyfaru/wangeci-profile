// E.164: a leading +, then 10 to 15 digits (country code + number), no spaces or dashes.
// Africa's Talking requires exactly this format for the `to` field.
export const E164_REGEX = /^\+\d{10,15}$/;

export const isE164 = (value: string) => E164_REGEX.test(value);

/** "0712 345 678" or "+254 712 345 678" to "+254712345678". Returns null if it cannot be made valid. */
export function normalizeKenyanOrE164(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, "");
  const candidate = compact.startsWith("+")
    ? compact
    : compact.startsWith("0")
      ? `+254${compact.slice(1)}`
      : compact.startsWith("254")
        ? `+${compact}`
        : compact;
  return isE164(candidate) ? candidate : null;
}
