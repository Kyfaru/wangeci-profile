/**
 * All copy + data for the landing page in one place.
 * Anything marked TODO(client) is a placeholder — Figma / the brief had no
 * real content for it. Swap the values here; components don't change.
 */

export const NAV_LINKS = [
  { label: "About Me", href: "/about" },
  { label: "Store", href: "/store" },
  { label: "Services", href: "/services" },
  { label: "Blog", href: "/blog" },
] as const;

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
  body: "Wangechi Kariuki, a former Kameme TV journalist, grew up in a dysfunctional family—a background that deeply impacted her upbringing. Despite the challenges, she held on to a dream: to become a journalist and create a better life for herself.",
} as const;

/** About accordion. Order matches Figma. First one is open by default. */
export const ABOUT_PANELS = [
  {
    label: "Entrepreneur",
    tint: "#0b7a4b", // green — the Fechi storefront
    image: "/images/DSC09759.jpg.jpeg",
    position: "50% 40%",
    // Copy from Figma.
    blurb:
      "Wangechi Kariuki, a former Kameme TV journalist, grew up in a dysfunctional family—a background that deeply impacted her upbringing. Despite the challenges, she held on to a dream: to become a journalist and create a better life for herself.",
  },
  {
    label: "Wife",
    tint: "#86183a", // maroon — warm evening, red bag
    image: "/images/777801391_1586673192824244_7703610571794898458_n.jpg",
    position: "50% 30%",
    blurb:
      "Marriage taught her that love is a daily decision. Together they are building a home rooted in faith, honesty and laughter.", // TODO(client)
  },
  {
    label: "Journalist",
    tint: "#2f76b8", // baby blue (a touch dark) — blue suit, sky
    image: "/images/738625637_2357925834736778_173712652579386944_n.png",
    position: "50% 20%",
    blurb:
      "Years in the newsroom taught her to listen closely and tell the truth plainly—skills that still shape every story she tells.", // TODO(client)
  },
  {
    label: "Mother",
    tint: "#6d34a8", // purple — child's headscarf
    image: "/images/755808300_1566042361553994_8807010966719274098_n.jpg",
    position: "50% 30%",
    blurb:
      "Motherhood is her greatest teacher and her deepest reason to keep going—everything she builds is for the children watching.", // TODO(client)
  },
  {
    label: "Author",
    tint: "#8a5d08", // deep gold/bronze — darker so the gold-bright label stays legible
    image: "/images/DSC09752.jpg.jpeg",
    position: "50% 25%",
    blurb:
      "Her memoir, From Pieces To Power, turns pain, loss and survival into a roadmap for anyone rebuilding from scratch.", // TODO(client)
  },
] as const;

/** "What she's building" stack. First = front card. */
export const BUSINESSES = [
  {
    name: "Fechi Organics",
    image: "/images/DSC09759.jpg.jpeg",
    alt: "Felister at the Fechi Organics shop front",
    // Copy from Figma.
    description:
      "A premium Kenyan skincare and beauty brand dedicated to providing high-quality, nature-inspired products that promote healthy, radiant skin and hair. We believe in delivering results through carefully selected ingredients, exceptional customer care, and innovative beauty solutions",
  },
  {
    name: "Blissful Oasis",
    image: "/images/646167440_122194935350576305_3078817188201477694_n.jpg",
    alt: "Blissful Oasis peaceful family retreat flyer",
    description:
      "A peaceful family retreat with a swimming pool, bonfire nights, outdoor movies and full-board meals—a place for families to slow down, reconnect and rest.", // TODO(client)
  },
  {
    name: "Home Care Solutions",
    image: "/images/284478781_424000679733263_1275750945625655161_n.jpg",
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
  cover: "/images/From Pieces to Power Front Cover.png",
  price: "KES 2000",
  oldPrice: "KES 3000",
  cta: "Get Your Copy Now",
} as const;

/** TODO(client): replace with real reader testimonials. */
export const TESTIMONIALS = [
  { quote: "I read it in one sitting and cried at the end. It gave me permission to start again.", author: "Grace W.", role: "Reader", place: "Nairobi" },
  { quote: "Honest, raw and full of hope. I've already bought copies for three friends.", author: "Mercy K.", role: "Book club host", place: "Nakuru" },
  { quote: "A story of pain that never feels hopeless. Every chapter left me stronger.", author: "Faith M.", role: "Teacher", place: "Thika" },
  { quote: "Her courage on the page is contagious. I finally chased the dream I had shelved for years.", author: "Janet N.", role: "Entrepreneur", place: "Eldoret" },
  { quote: "The kind of book you hand to a daughter, a sister, a friend. Deeply moving.", author: "Ruth A.", role: "Nurse", place: "Mombasa" },
] as const;

export const FOOTER = {
  blurb:
    "Author, entrepreneur and former journalist Felister “Wangechi” Kariuki—turning pieces into power, one story at a time.",
  explore: NAV_LINKS,
  ventures: BUSINESSES.map((b) => b.name),
  // TODO(client): real contact details.
  contact: {
    email: "hello@wangeci.com",
    phone: "+254 700 000 000",
    place: "Nairobi, Kenya",
  },
  // TODO(client): real profile URLs.
  socials: [
    { label: "Facebook", icon: "lucide:facebook", href: "#" },
    { label: "Instagram", icon: "lucide:instagram", href: "#" },
    { label: "YouTube", icon: "lucide:youtube", href: "#" },
    { label: "TikTok", icon: "tabler:brand-tiktok", href: "#" },
    { label: "LinkedIn", icon: "lucide:linkedin", href: "#" },
  ],
} as const;
