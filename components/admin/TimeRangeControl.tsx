import Link from "next/link";

import { PRESETS, PRESET_LABELS, type TimeRange } from "@/lib/admin/time-range";
import { cn } from "@/lib/cn";

/**
 * Period picker. Presets travel as just their NAME in the link (?range=7d); the server turns the name
 * into real times with its own clock. The custom form sends from and to, which the server validates and caps.
 */
export function TimeRangeControl({ range, basePath }: { range: TimeRange; basePath: string }) {
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <nav aria-label="Time range" className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Link
            key={p}
            href={`${basePath}?range=${p}`}
            aria-current={!range.custom && range.key === p}
            className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", !range.custom && range.key === p ? "border-navy bg-navy text-cream" : "border-black/20 text-black hover:border-navy")}
          >
            {PRESET_LABELS[p]}
          </Link>
        ))}
      </nav>
      <form action={basePath} method="get" className="flex flex-wrap items-end gap-2 text-sm">
        <label>
          <span className="block text-xs text-black/60">From</span>
          <input type="date" name="from" required className="rounded-lg border-black/20 py-1.5 text-sm" />
        </label>
        <label>
          <span className="block text-xs text-black/60">To</span>
          <input type="date" name="to" required className="rounded-lg border-black/20 py-1.5 text-sm" />
        </label>
        <button type="submit" className="rounded-full border border-black/20 px-4 py-1.5 hover:border-navy">
          Apply
        </button>
      </form>
    </div>
  );
}
