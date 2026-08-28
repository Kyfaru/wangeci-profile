/**
 * Mock businesses/ventures fixtures for the "businesses" section of the
 * profile site. Includes Fechi Organics per existing project convention.
 */

export interface Business {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logo: string;
  coverImage: string;
  website?: string;
  category: string;
  location: string;
  foundedYear: number;
}

export const MOCK_BUSINESSES: Business[] = [
  {
    id: "biz_fechi-organics",
    slug: "fechi-organics",
    name: "Fechi Organics",
    tagline: "Skincare made the way your grandmother made it — on purpose.",
    description:
      "A Nairobi-based skincare line built on unrefined shea butter and cooperative-sourced ingredients, founded by Felister Kariuki as she rebuilt her life after divorce.",
    logo: "/businesses/fechi-organics/logo.png",
    coverImage: "/businesses/fechi-organics/cover.jpg",
    website: "https://fechiorganics.example.com",
    category: "Skincare & Wellness",
    location: "Nairobi, Kenya",
    foundedYear: 2022,
  },
  {
    id: "biz_pieces-to-power-press",
    slug: "pieces-to-power-press",
    name: "Pieces To Power Press",
    tagline: "Publishing and coaching for women rebuilding from scratch.",
    description:
      "The small publishing and workshop arm behind Wangechi's books, journals, and the annual Rebuild Retreat for women starting over after loss.",
    logo: "/businesses/pieces-to-power-press/logo.png",
    coverImage: "/businesses/pieces-to-power-press/cover.jpg",
    website: "https://piecestopowerpress.example.com",
    category: "Publishing & Coaching",
    location: "Nairobi, Kenya",
    foundedYear: 2024,
  },
  {
    id: "biz_the-rebuild-collective",
    slug: "the-rebuild-collective",
    name: "The Rebuild Collective",
    tagline: "A membership community for women rebuilding their income.",
    description:
      "A paid membership community offering monthly live coaching calls, templates, and peer accountability circles for women starting a business after a major life disruption.",
    logo: "/businesses/the-rebuild-collective/logo.png",
    coverImage: "/businesses/the-rebuild-collective/cover.jpg",
    category: "Community & Membership",
    location: "Remote / East Africa",
    foundedYear: 2025,
  },
];

export function findBusinessBySlug(slug: string): Business | undefined {
  return MOCK_BUSINESSES.find((b) => b.slug === slug);
}
