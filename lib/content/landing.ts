/**
 * All copy + data for the landing page in one place.
 * Anything marked TODO(client) is a placeholder — Figma / the brief had no
 * real content for it. Swap the values here; components don't change.
 */

/** `live: false` links stay hidden until their page exists (Phase 2 flips them). */
const ALL_NAV_LINKS = [
  { label: "About Me", href: "/about", live: true },
  { label: "Store", href: "/store", live: true },
  { label: "Services", href: "/services", live: true },
  { label: "Blog", href: "/blog", live: false },
] as const;

export const NAV_LINKS = ALL_NAV_LINKS.filter((l) => l.live);

/** Navbar only — the footer's Explore list stays on NAV_LINKS. */
export const NAVBAR_LINKS = [{ label: "Home", href: "/" }, ...NAV_LINKS] as const;

export const BOOK_HREF = "/store/from-pieces-to-power";

/** Hero: rotates in this order. `year` = year she started that role. */
export const HERO_ROLES = [
  { label: "Entrepreneur", title: "an entrepreneur", year: 2012, color: "#5fd39a" }, // TODO(client): confirm year
  { label: "Mother", title: "a mother", year: 2008, color: "#c08bff" }, // TODO(client): confirm year
  { label: "Wife", title: "a wife", year: 2005, color: "#ff7a9c" }, // TODO(client): confirm year
  { label: "Journalist", title: "a journalist", year: 2010, color: "#7cc4ff" }, // TODO(client): confirm year
  { label: "Author", title: "an author", year: 2026, color: "#f2b90d" }, // year from Figma
] as const;

export const ABOUT = {
  heading: "About Me",
  body: "Wangeci Kariuki, a former Kameme TV journalist, grew up in a dysfunctional family—a background that deeply impacted her upbringing. Despite the challenges, she held on to a dream: to become a journalist and create a better life for herself.",
} as const;

/** About accordion. Order matches Figma. First one is open by default. */
export const ABOUT_PANELS = [
  {
    label: "Entrepreneur",
    tint: "#0b7a4b", // green — the Fechi storefront
    image: "/images/fechi-organics-shopfront.jpg",
    position: "50% 40%",
    // Copy from Figma.
    blurb:
      "Wangeci Kariuki, a former Kameme TV journalist, grew up in a dysfunctional family—a background that deeply impacted her upbringing. Despite the challenges, she held on to a dream: to become a journalist and create a better life for herself.",
  },
  {
    label: "Wife",
    tint: "#86183a", // maroon — warm evening, red bag
    image: "/images/wangeci-wife.jpg",
    position: "50% 30%",
    blurb:
      "Marriage taught her that love is a daily decision. Together they are building a home rooted in faith, honesty and laughter.", // TODO(client)
  },
  {
    label: "Journalist",
    tint: "#2f76b8", // baby blue (a touch dark) — blue suit, sky
    image: "/images/wangeci-journalist.png",
    position: "50% 20%",
    blurb:
      "Years in the newsroom taught her to listen closely and tell the truth plainly—skills that still shape every story she tells.", // TODO(client)
  },
  {
    label: "Mother",
    tint: "#6d34a8", // purple — child's headscarf
    image: "/images/wangeci-mother.jpg",
    position: "50% 30%",
    blurb:
      "Motherhood is her greatest teacher and her deepest reason to keep going—everything she builds is for the children watching.", // TODO(client)
  },
  {
    label: "Author",
    tint: "#8a5d08", // deep gold/bronze — darker so the gold-bright label stays legible
    image: "/images/wangeci-author.jpg",
    position: "50% 25%",
    blurb:
      "Her memoir, From Pieces To Power, turns pain, loss and survival into a roadmap for anyone rebuilding from scratch.", // TODO(client)
  },
] as const;

/** "What she's building" stack. First = front card. */
export const BUSINESSES = [
  {
    name: "Fechi Organics",
    image: "/images/fechi-organics-shopfront.jpg",
    alt: "Wangeci Kariuki at the Fechi Organics shop front",
    // Copy from Figma.
    description:
      "A premium Kenyan skincare and beauty brand dedicated to providing high-quality, nature-inspired products that promote healthy, radiant skin and hair. We believe in delivering results through carefully selected ingredients, exceptional customer care, and innovative beauty solutions",
  },
  {
    name: "Blissful Oasis",
    image: "/images/blissful-oasis-flyer.jpg",
    alt: "Blissful Oasis peaceful family retreat flyer",
    description:
      "A peaceful family retreat with a swimming pool, bonfire nights, outdoor movies and full-board meals—a place for families to slow down, reconnect and rest.", // TODO(client)
  },
  {
    name: "Home Care Solutions",
    image: "/images/home-care-solutions-logo.jpg",
    alt: "Home Care Solutions logo",
    description:
      "Dependable, compassionate home-care services that give families peace of mind, delivered by trained and caring professionals.", // TODO(client)
  },
] as const;

export const BOOK = {
  titleTop: "From Pieces",
  titleBottom: "To",
  accent: "Power",
  blurb:
    "She walked barefoot to school on dusty village roads, raised by siblings barely older than herself. Her mother-an invisible hero-was always in another town, selling maize to keep her seven children alive. When her mother died, she lost more than a parent - she lost her home, her place in the world.",
  cover: "/images/from-pieces-to-power-front-cover.png",
  price: "KES 2000",
  oldPrice: "KES 3000",
  cta: "Get Your Copy Now",
} as const;

/** TODO(client): real reader testimonials only. Empty = the section is hidden (no invented quotes). */
export const TESTIMONIALS: readonly { quote: string; author: string; role: string; place: string }[] = [];

export const FOOTER = {
  blurb:
    "Author, entrepreneur and former journalist Wangeci Kariuki—turning pieces into power, one story at a time.",
  explore: [{ label: "Home", href: "/" }, ...NAV_LINKS],
  ventures: BUSINESSES.map((b) => b.name),
  // Contact comes from SITE.contact (null = hidden in production).
  // TODO(client): real profile URLs. href null = hidden in production.
  socials: [
    { label: "Facebook", icon: "lucide:facebook", href: null as string | null },
    { label: "Instagram", icon: "lucide:instagram", href: null as string | null },
    { label: "YouTube", icon: "lucide:youtube", href: null as string | null },
    { label: "TikTok", icon: "tabler:brand-tiktok", href: null as string | null },
    { label: "LinkedIn", icon: "lucide:linkedin", href: null as string | null },
  ],
} as const;
