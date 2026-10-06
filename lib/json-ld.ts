/** Serialises structured data for a <script type="application/ld+json"> tag without allowing "</script>" tricks. */
export const jsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\u003c");
