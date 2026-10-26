"use client";

import Script from "next/script";

declare global {
  interface Window {
    chatwootSDK?: { run: (options: { websiteToken: string; baseUrl: string }) => void };
  }
}

/** Loads the Chatwoot chat bubble. Rendered only when the server has both settings (see the marketing layout). */
export function ChatwootWidget({ baseUrl, websiteToken }: { baseUrl: string; websiteToken: string }) {
  return (
    <Script
      src={`${baseUrl.replace(/\/$/, "")}/packs/js/sdk.js`}
      strategy="lazyOnload"
      onLoad={() => window.chatwootSDK?.run({ websiteToken, baseUrl })}
    />
  );
}
