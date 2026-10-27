"use client";

import { useState } from "react";

import { importManuscriptAction } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin/ActionForm";
import { countWords, splitManuscript } from "@/lib/reading/text";

/** Paste a whole book; chapters start at lines beginning "## ". Shows what will be created before you submit. */
export function ManuscriptImport({ editionId, needsReason }: { editionId: string; needsReason: boolean }) {
  const [text, setText] = useState("");
  const chapters = text.trim() ? splitManuscript(text) : [];

  return (
    <details className="rounded-2xl border border-black/10 bg-white p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-display text-xl text-black">Paste whole manuscript</summary>
      <p className="mt-1 text-sm text-black/60">Start each chapter with a line like <code>## Chapter title</code>. Importing creates the chapters in order.</p>
      <div className="mt-3">
        <ActionForm action={importManuscriptAction} hidden={{ editionId }} submitLabel={`Import ${chapters.length} chapter${chapters.length === 1 ? "" : "s"}`} withReason={needsReason}>
          <textarea name="manuscript" required rows={14} value={text} onChange={(e) => setText(e.target.value)} className="w-full rounded-xl border-black/20 font-mono text-sm" aria-label="Manuscript" />
          {chapters.length > 0 && (
            <ol className="list-decimal space-y-1 pl-5 text-sm text-black/70">
              {chapters.map((c, i) => (
                <li key={i}>{c.title} <span className="text-black/50">({countWords(c.body)} words)</span></li>
              ))}
            </ol>
          )}
        </ActionForm>
      </div>
    </details>
  );
}
