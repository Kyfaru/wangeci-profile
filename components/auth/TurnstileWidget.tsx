"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileHandle {
  /** Turnstile tokens are single use: call this after every request that used one. */
  reset: () => void;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Cloudflare Turnstile bot check. Renders nothing when no site key is configured (the server then
 * has the check switched off too). `onToken(null)` means the token expired or was reset.
 */
export const TurnstileWidget = forwardRef<TurnstileHandle, { siteKey?: string; onToken: (token: string | null) => void }>(
  function TurnstileWidget({ siteKey, onToken }, ref) {
    const container = useRef<HTMLDivElement>(null);
    const widgetId = useRef<string | undefined>(undefined);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset() {
        onTokenRef.current(null);
        if (widgetId.current) window.turnstile?.reset(widgetId.current);
      },
    }));

    useEffect(() => {
      if (!siteKey || !container.current) return;
      let cancelled = false;

      const mount = () => {
        if (cancelled || !container.current || !window.turnstile || widgetId.current) return;
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          appearance: "interaction-only", // invisible unless Cloudflare needs the person to act
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
      };

      if (window.turnstile) mount();
      else {
        let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
        if (!script) {
          script = document.createElement("script");
          script.src = SCRIPT_SRC;
          script.async = true;
          document.head.appendChild(script);
        }
        script.addEventListener("load", mount);
      }

      return () => {
        cancelled = true;
        if (widgetId.current) window.turnstile?.remove(widgetId.current);
        widgetId.current = undefined;
      };
    }, [siteKey]);

    if (!siteKey) return null;
    return <div ref={container} className="mt-3 empty:hidden" />;
  },
);
