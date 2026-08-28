import { cn } from "@/lib/cn";
import { AppleIcon, FacebookIcon, GoogleIcon } from "./icons";

export interface OAuthButtonRowProps {
  onGoogleClick?: () => void;
  onAppleClick?: () => void;
  onFacebookClick?: () => void;
  className?: string;
}

/**
 * Three circular OAuth buttons, in Google / Apple / Facebook order.
 *
 * UI-only for this phase — no real OAuth wiring. Handlers are optional so
 * this can be dropped in before auth is implemented; a disabled look isn't
 * forced since the call site may want them enabled for a "coming soon" toast.
 */
export function OAuthButtonRow({
  onGoogleClick,
  onAppleClick,
  onFacebookClick,
  className,
}: OAuthButtonRowProps) {
  const baseStyles =
    "inline-flex size-12 items-center justify-center rounded-full border border-navy/15 bg-white transition-colors duration-150 hover:bg-navy/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-cream";

  return (
    <div className={cn("flex items-center justify-center gap-4", className)}>
      <button
        type="button"
        aria-label="Continue with Google"
        onClick={onGoogleClick}
        className={baseStyles}
      >
        <GoogleIcon className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Continue with Apple"
        onClick={onAppleClick}
        className={baseStyles}
      >
        <AppleIcon className="size-5 text-navy" />
      </button>
      <button
        type="button"
        aria-label="Continue with Facebook"
        onClick={onFacebookClick}
        className={baseStyles}
      >
        <FacebookIcon className="size-5" />
      </button>
    </div>
  );
}
