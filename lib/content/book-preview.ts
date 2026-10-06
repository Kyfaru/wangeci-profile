/**
 * Copy for the book preview page (`/store/[slug]`), keyed by book slug.
 * Anything marked TODO(client) is placeholder — swap the values here;
 * components don't change.
 */

export interface PreviewSection {
  /** Anchor id + TOC key. */
  id: string;
  /** Includes its number ("1. …"), exactly as shown in the TOC and heading. */
  title: string;
  paragraphs: readonly string[];
  examples?: readonly string[];
}

export interface BookPreviewContent {
  readTime: string;
  audioTime: string;
  intro: string;
  sections: readonly PreviewSection[];
}

/**
 * No summary-style sections: the earlier Figma placeholder text described a different
 * book. TODO(client): real author note and synopsis. Phase 2 reads this from the catalogue.
 */
export const BOOK_PREVIEWS: Record<string, BookPreviewContent> = {
  "from-pieces-to-power": {
    readTime: "",
    audioTime: "",
    intro:
      "She walked barefoot to school on dusty village roads, raised by siblings barely older than herself. Her mother, an invisible hero, was always in another town, selling maize to keep her seven children alive. When her mother died, she lost more than a parent: she lost her home, her place in the world.",
    sections: [],
  },
};

/** Any book without its own entry gets this, so `/store/<slug>` never breaks. */
export const DEFAULT_PREVIEW: BookPreviewContent = {
  readTime: "",
  audioTime: "",
  intro: "", // TODO(client)
  sections: [],
};
