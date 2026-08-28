import { Icon, type IconProps } from "@iconify/react";

/**
 * Icon name restricted to the icon sets installed in this project
 * (@iconify-json/lucide, /tabler, /solar, /logos, /ic) — prevents typos
 * from silently resolving to a missing icon at runtime, since Iconify
 * accepts any string but only these prefixes have local icon data bundled.
 * `logos`/`ic` were added for the login page's brand-colored OAuth glyphs
 * (`logos:google-icon`, `logos:facebook`, `ic:baseline-apple`).
 */
export type AppIconName =
  | `lucide:${string}`
  | `tabler:${string}`
  | `solar:${string}`
  | `logos:${string}`
  | `ic:${string}`;

export type AppIconProps = Omit<IconProps, "icon" | "width" | "height"> & {
  icon: AppIconName;
  /** Pixel size applied to both width and height. Defaults to 20. */
  size?: number | string;
};

const DEFAULT_ICON_SIZE = 20;
// Most outline icon sets (lucide, tabler) render at this stroke weight by
// convention across the app; solar's icon styles ignore it harmlessly.
const DEFAULT_STROKE_WIDTH = 1.75;

/**
 * Renders an icon from one of the app's approved icon sets.
 * @param icon - icon name prefixed with its set, e.g. "lucide:book-open".
 * @param size - pixel size applied to width and height, defaults to 20.
 * @param props - any other @iconify/react Icon prop (className, color,
 *   strokeWidth override, etc).
 * @returns the rendered <Icon /> element.
 * Why it exists: gives every icon in the app a single default size/stroke
 * so call sites don't have to repeat those props every time.
 */
export function AppIcon({
  icon,
  size = DEFAULT_ICON_SIZE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  ...props
}: AppIconProps) {
  return (
    <Icon
      icon={icon}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      {...props}
    />
  );
}
