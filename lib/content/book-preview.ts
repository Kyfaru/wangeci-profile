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

const PLACEHOLDER = [
  "Summary for this section is coming soon.", // TODO(client): real copy
] as const;

export const BOOK_PREVIEWS: Record<string, BookPreviewContent> = {
  "from-pieces-to-power": {
    readTime: "5 hrs read", // TODO(client): confirm
    audioTime: "1 hr audio", // TODO(client): confirm
    // Copy from Figma.
    intro:
      "“When you believe a lie, you begin to live in bondage; the truth is what sets you free.” This book answers how Christians can navigate an increasingly secular world while holding onto their faith.",
    sections: [
      {
        id: "lies-prevail-in-secular-society",
        title: "1. Lies Prevail in Secular Society",
        // Copy from Figma.
        paragraphs: [
          "Secular society often embraces ideas that contradict Christian teachings, claiming they lead to freedom and happiness. Yet, these same ideas frequently result in pain and instability. Divorce, for instance, is celebrated as a form of emancipation but often leaves women disadvantaged and children emotionally scarred.",
          "Treating ideas as truth leads many to fall for falsehoods, ignoring the long-term damage they cause. For example, the concept of “sexual liberation” promised personal freedom but is often linked with rising loneliness and disconnected relationships. Contrast this with biblical values, which advocate committed partnerships for holistic well-being.",
          "Christians are taught that happiness stems from truth, such as God’s promises, rather than societal constructs. Recognizing these lies and teaching others to discern them is an essential step for anyone seeking a more fulfilling life that aligns with scripture.",
        ],
        examples: [
          "Divorce rates and their disproportionate impact on women and children.",
          "Cultural discussions equating liberation with discarding biblical values.",
          "Declining happiness levels compared to earlier decades of stronger shared values.",
        ],
      },
      // TODO(client): titles from Figma, body copy is placeholder.
      { id: "the-devil-as-a-master-of-deception", title: "2. The Devil as a Master of Deception", paragraphs: PLACEHOLDER },
      { id: "becoming-more-like-jesus", title: "3. Becoming More Like Jesus", paragraphs: PLACEHOLDER },
      { id: "desire-as-modern-slavery", title: "4. Desire as Modern Slavery", paragraphs: PLACEHOLDER },
      { id: "habits-shape-our-destiny", title: "5. Habits Shape Our Destiny", paragraphs: PLACEHOLDER },
      { id: "spiritual-practices-build-inner-strength", title: "6. Spiritual Practices Build Inner Strength", paragraphs: PLACEHOLDER },
      { id: "ideas-spread-like-viruses", title: "7. Ideas Spread Like Viruses", paragraphs: PLACEHOLDER },
      { id: "a-post-christian-world-requires-new-strategies", title: "8. A Post-Christian World Requires New Strategies", paragraphs: PLACEHOLDER },
      { id: "the-importance-of-clarity-and-truth", title: "9. The Importance of Clarity and Truth", paragraphs: PLACEHOLDER },
      { id: "takeaways", title: "10. Takeaways", paragraphs: PLACEHOLDER },
    ],
  },
};

/** Any book without its own entry gets this, so `/store/<slug>` never breaks. */
export const DEFAULT_PREVIEW: BookPreviewContent = {
  readTime: "",
  audioTime: "",
  intro: "", // TODO(client)
  sections: [],
};
