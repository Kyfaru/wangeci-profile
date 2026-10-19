/**
 * The one definition of "chapter text" shared by the reader, the catalogue preview, the publish script
 * and the admin editor, so the stored word count always matches what the reader shows.
 */

/** Windows line endings, a BOM and runs of blank lines are all noise: store one canonical form. */
export function normaliseBody(raw: string): string {
  return raw.replace(/^﻿/, "").replace(/\r\n?/g, "\n").trim().replace(/\n{3,}/g, "\n\n");
}

/** Paragraphs are separated by one or more blank lines. */
export function splitParagraphs(body: string): string[] {
  return normaliseBody(body)
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Words as the reader counts them: per paragraph, runs of non-space characters. */
export function countWords(body: string): number {
  return splitParagraphs(body).reduce((n, p) => n + p.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Cuts a pasted manuscript into chapters. A chapter begins at a line that starts with "## "; anything
 * before the first such line is ignored. No headings means no chapters.
 */
export function splitManuscript(text: string): { title: string; body: string }[] {
  const chapters: { title: string; lines: string[] }[] = [];
  for (const line of normaliseBody(text).split("\n")) {
    if (line.startsWith("## ")) chapters.push({ title: line.slice(3).trim(), lines: [] });
    else chapters.at(-1)?.lines.push(line);
  }
  return chapters.map((c) => ({ title: c.title, body: normaliseBody(c.lines.join("\n")) }));
}
