import { AboutPanels } from "@/components/marketing/AboutPanels";
import { BookSection } from "@/components/marketing/BookSection";
import { BusinessStack } from "@/components/marketing/BusinessStack";
import { Hero } from "@/components/marketing/Hero";
import { Testimonials } from "@/components/marketing/Testimonials";

export default function LandingPage() {
  return (
    <>
      <Hero />
      <AboutPanels />
      <BusinessStack />
      <BookSection />
      <Testimonials />
    </>
  );
}
