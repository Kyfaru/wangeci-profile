import { ChatwootWidget } from "@/components/marketing/ChatwootWidget";
import { Footer } from "@/components/marketing/Footer";
import { Navbar } from "@/components/marketing/Navbar";
import { env } from "@/lib/env";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <Footer />
      {env.CHATWOOT_BASE_URL && env.CHATWOOT_WEBSITE_TOKEN && (
        <ChatwootWidget baseUrl={env.CHATWOOT_BASE_URL} websiteToken={env.CHATWOOT_WEBSITE_TOKEN} />
      )}
    </>
  );
}
