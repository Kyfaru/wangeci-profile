import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Outlined button (black stroke, no background) that "spills" a gold fill on
 * hover. The liquid pseudo-elements live in `.btn-fill` (app/globals.css).
 */
export function FillButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "btn-fill relative isolate inline-block overflow-hidden rounded-full border border-black px-6 py-2.5 text-lg font-medium tracking-[0.05em] text-black transition-colors duration-200 ease-in",
        className,
      )}
    >
      {children}
    </Link>
  );
}
