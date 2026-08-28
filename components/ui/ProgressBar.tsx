import { cn } from "@/lib/cn";

export interface ProgressBarProps {
  /** Current value. */
  value: number;
  /** Maximum value, defaults to 100. */
  max?: number;
  variant?: "gold" | "navy" | "green";
  size?: "sm" | "md";
  /** Optional label rendered above the bar, e.g. "Chapter 3 of 10". */
  label?: string;
  /** Shows the numeric percentage to the right of the label. */
  showValue?: boolean;
  className?: string;
}

const VARIANT_STYLES = {
  gold: "bg-gold-bright",
  navy: "bg-navy",
  green: "bg-green",
};

const SIZE_STYLES = {
  sm: "h-1.5",
  md: "h-2.5",
};

/** Determinate progress bar, e.g. reading progress or a form's completion. */
export function ProgressBar({
  value,
  max = 100,
  variant = "gold",
  size = "md",
  label,
  showValue = false,
  className,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={cn("w-full", className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-sm text-navy">
          {label && <span className="font-medium">{label}</span>}
          {showValue && (
            <span className="text-gray">{Math.round(percent)}%</span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className={cn(
          "w-full overflow-hidden rounded-full bg-gray-light",
          SIZE_STYLES[size],
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-out",
            VARIANT_STYLES[variant],
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
