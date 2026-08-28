/**
 * Minimal classname joiner used across `components/ui/*`.
 *
 * Deliberately not `clsx`/`tailwind-merge` — this project has no such
 * dependency yet, and the primitives here don't need conflict resolution
 * (e.g. "px-2" vs "px-4"), just conditional joining. Falsy values are
 * dropped so callers can write `cn("base", condition && "variant")`.
 */
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
