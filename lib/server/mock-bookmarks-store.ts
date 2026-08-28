/**
 * In-memory mock bookmark store — server-only, resets on server restart.
 * Stands in for a real bookmarks table; POST/GET below just read/write this
 * array for the lifetime of the dev server process.
 */

export interface Bookmark {
  id: string;
  userId: string;
  editionId: string;
  bookSlug: string;
  chapterIdx: number;
  position: number;
  note?: string;
  createdAt: string;
}

const bookmarks: Bookmark[] = [
  {
    id: "bkm_1",
    userId: "usr_1",
    editionId: "fptp-ebook-v1",
    bookSlug: "from-pieces-to-power",
    chapterIdx: 2,
    position: 0.35,
    note: "The line about the register — come back to this.",
    createdAt: "2026-08-25T18:00:00.000Z",
  },
];

let nextId = bookmarks.length + 1;

export function listBookmarks(userId: string, editionId?: string): Bookmark[] {
  return bookmarks
    .filter(
      (b) => b.userId === userId && (!editionId || b.editionId === editionId)
    )
    .sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function createBookmark(
  input: Omit<Bookmark, "id" | "createdAt">
): Bookmark {
  const bookmark: Bookmark = {
    ...input,
    id: `bkm_${nextId++}`,
    createdAt: new Date().toISOString(),
  };
  bookmarks.push(bookmark);
  return bookmark;
}
