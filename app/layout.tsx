import type { Metadata } from "next";
import { aeonik, wayfindingSans } from "./fonts";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Felister Wangechi Kariuki",
  description:
    "Author and entrepreneur platform for Felister \"Wangechi\" Kariuki, home of \"From Pieces To Power\".",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${aeonik.variable} ${wayfindingSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
