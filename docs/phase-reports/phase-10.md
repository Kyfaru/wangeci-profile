# Phase 10: Book authoring

Branch `phase/10-book-authoring` (from `phase/9-public-fixes`).

- Admin edition page `/admin/content/[editionId]`: readiness checklist, chapter table (words, free preview, audio, move up/down, delete last), controlled chapter editor with live word/paragraph count and a local draft backup, "paste whole manuscript" (chapters start at `## Title` lines), "New book" form.
- Server (`lib/admin/content.ts`, actions in `app/admin/actions.ts`): createBook, saveChapter, moveChapter, deleteChapter, attachChapterAudio, importManuscript; one audit row each (no chapter text in audit meta), edition row locked per write, reason only needed for live/owned editions, moves/deletes refused once readers have positions or bookmarks.
- Publishing refuses when `getPublishIssues` has blocking items (price, no chapters, empty text, missing audio, gaps).
- Audio: presigned PUT route `/api/admin/chapter-audio` (owner only, rate limited, .mp3/.m4a, 400 MB cap), R2 put/head/delete helpers; needs R2 CORS and `connect-src` (added).
- Preview: `?preview=<editionId>` in the reader for admins (draft edition, nothing saved, preview kept across chapters).
- Fixes: owners of a retired edition can still read/listen (`getOwnedBook`), missing saved chapter opens chapter 1 at word 0 (`resolveStart`), shared text helpers (`lib/reading/text.ts`), publish script deletes stale chapters/assets, library cover N+1 removed.
- Tests: 188 unit/DB tests, Playwright `e2e/authoring.spec.ts` (owner signs in with TOTP, creates a book, imports two chapters, previews, publishes, reader reads it; negatives pass; audio upload skipped, needs real R2).

## Known gaps
`Edition.isActive` defaults to true in the schema (createBook sets false); audio upload untested against real R2; `ChapterReader` keeps its own word splitting (reference tokenisation).
