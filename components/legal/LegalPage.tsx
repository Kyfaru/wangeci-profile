import type { ReactNode } from "react";

/** Shared layout for the legal pages. Every legal page is a DRAFT until the client's lawyer has reviewed it. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-[70vh] max-w-[760px] px-6 pb-24 pt-32 md:pt-40">
      <p role="note" className="rounded-xl border border-gold bg-gold/10 px-4 py-3 text-sm text-navy">
        <strong>Draft, awaiting lawyer review.</strong> This text is a plain-language starting point, not final legal advice.
      </p>
      <h1 className="mt-8 font-display text-4xl text-navy md:text-5xl">{title}</h1>
      <p className="mt-2 text-sm text-navy/50">Last updated: {updated}</p>
      <div className="mt-8 space-y-5 text-lg leading-relaxed text-navy/80 [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-navy [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-2">
        {children}
      </div>
    </div>
  );
}
