import { cn } from "@/lib/cn";
import { StarIcon } from "./icons";

export interface RatingBadgeProps {
  /** e.g. 4.8 */
  rating: number;
  /** Optional review count shown in parentheses, e.g. (128) */
  count?: number;
  size?: "sm" | "md";
  className?: string;
}

const SIZE_STYLES = {
  sm: { wrap: "text-xs gap-1 px-2 py-1", star: "size-3" },
  md: { wrap: "text-sm gap-1.5 px-3 py-1.5", star: "size-4" },
};

/** Star + numeric rating pill, e.g. "★ 4.8 (128)". */
export function RatingBadge({
  rating,
  count,
  size = "md",
  className,
}: RatingBadgeProps) {
  const styles = SIZE_STYLES[size];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gold/15 font-medium text-navy",
        styles.wrap,
        className,
      )}
    >
      <StarIcon className={cn(styles.star, "text-gold-bright")} />
      {rating.toFixed(1)}
      {typeof count === "number" && (
        <span className="text-gray">({count})</span>
      )}
    </span>
  );
}
