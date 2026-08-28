import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface StatChipProps {
  icon: ReactNode;
  /** e.g. "1.2k" or 42 */
  count: string | number;
  /** Optional trailing label, e.g. "readers" */
  label?: string;
  variant?: "neutral" | "navy" | "gold";
  className?: string;
}

const VARIANT_STYLES = {
  neutral: "bg-gray-light text-navy",
  navy: "bg-navy text-cream",
  gold: "bg-gold/15 text-navy",
};

/** Icon + count pill, e.g. a heart icon with a like count. */
export function StatChip({
  icon,
  count,
  label,
  variant = "neutral",
  className,
}: StatChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium",
        VARIANT_STYLES[variant],
        className,
      )}
    >
      <span className="shrink-0 [&>svg]:size-4">{icon}</span>
      <span>{count}</span>
      {label && <span className="text-gray font-normal">{label}</span>}
    </span>
  );
}
