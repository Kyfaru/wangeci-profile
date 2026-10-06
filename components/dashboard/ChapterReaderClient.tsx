"use client";

import dynamic from "next/dynamic";

// Client-only: pages are measured on this screen and the text size is remembered in this browser,
// neither of which exists on the server.
export const ChapterReaderClient = dynamic(() => import("@/components/dashboard/ChapterReader").then((m) => m.ChapterReader), {
  ssr: false,
  loading: () => <div className="min-h-0 flex-1 px-6 py-8 text-black/50 md:px-16">Loading chapter...</div>,
});
