"use client";

import countries from "@/lib/countries.json";

const OPTIONS = (countries as { name: string; iso2: string; dialCode: string; flag: string }[]).filter((c) => c.dialCode);

/** Country dial-code picker + number box. Returns nothing itself: the parent combines them. */
export function PhoneField({
  dialCode,
  number,
  onDialCode,
  onNumber,
  label = "Phone number",
}: {
  dialCode: string;
  number: string;
  onDialCode: (v: string) => void;
  onNumber: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="flex items-stretch gap-2 rounded-2xl border border-line bg-white px-3 py-2 focus-within:border-blue focus-within:ring-2 focus-within:ring-blue/30">
      <select
        aria-label="Country code"
        value={dialCode}
        onChange={(e) => onDialCode(e.target.value)}
        className="w-[7.5rem] shrink-0 rounded-lg border-0 bg-transparent py-1 pl-1 pr-6 text-sm text-navy focus:ring-0"
      >
        {OPTIONS.map((c) => (
          <option key={c.iso2} value={c.dialCode}>
            {c.flag} {c.dialCode} ({c.iso2})
          </option>
        ))}
      </select>
      <label className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-gray">{label}</span>
        <input
          value={number}
          onChange={(e) => onNumber(e.target.value.replace(/[^\d\s-]/g, ""))}
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="712 345 678"
          className="w-full border-0 bg-transparent p-0 text-base text-navy placeholder:text-gray/60 focus:ring-0"
        />
      </label>
    </div>
  );
}

/** "+254" + "0712 345 678" -> "+254712345678" (a leading 0 is dropped). Returns null if too short/long. */
export function toE164(dialCode: string, number: string): string | null {
  const digits = number.replace(/\D/g, "").replace(/^0+/, "");
  const full = `${dialCode}${digits}`;
  return /^\+\d{10,15}$/.test(full) ? full : null;
}
