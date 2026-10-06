import type { Metadata } from "next";
import { SITE, SITE_TITLE } from "@/lib/site";
import { aeonik, wayfindingSans } from "./fonts";
import { AppProviders } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE_TITLE, template: `%s | ${SITE.authorName}` },
  description: SITE.description,
  alternates: { canonical: "/" },
  openGraph: { siteName: SITE.authorName, type: "website", locale: "en_KE" },
  // Only the production domain is indexed (staging and previews are noindex).
  robots: SITE.isProduction ? undefined : { index: false, follow: false },
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
