# Publishing a book edition

Until the admin upload page exists, a book goes live with one command.

```
node --env-file=.env.local scripts/publish-edition.ts path/to/manifest.json --dry-run
node --env-file=.env.local scripts/publish-edition.ts path/to/manifest.json --activate
```

Flags: `--dry-run` checks everything and writes nothing. `--no-upload` writes only the database (local testing). `--activate` makes the edition buyable (without it the edition is created inactive). `--yes` is required when `DATABASE_URL` is not on this computer, so you cannot change a shared database by accident.

## Manifest (JSON)

```json
{
  "work": { "slug": "from-pieces-to-power", "title": "From Pieces To Power", "author": "Wangeci Kariuki", "description": "The real synopsis" },
  "edition": { "format": "EPUB", "title": "Ebook", "price": 1500, "currency": "KES" },
  "cover": "cover.png",
  "chapters": [
    { "title": "Chapter 1", "file": "chapter-01.txt", "isFreePreview": true },
    { "title": "Chapter 2", "file": "chapter-02.txt" }
  ]
}
```

- **Ebook** (`"format": "EPUB"`): each chapter is a plain text file; blank lines separate paragraphs. Exactly the chapters with `isFreePreview: true` can be read without buying.
- **Audiobook** (`"format": "AUDIOBOOK"`): each chapter has `"audio": "ch1.mp3"` (or `.m4a`) and `"durationSeconds"`, and optionally `"file": "ch1.txt"` with the chapter text, which the listening page shows as read-along text (words turn black as they are spoken; timing is estimated from word length until a real timing file exists). Files should be 192 to 320 kbps, constant bitrate, with the index at the start of the file (ffmpeg `-movflags +faststart` for m4a) so scrubbing is exact. If `ffprobe` is installed the script warns about other bitrates. Audio goes to the PROTECTED bucket only.
- Paths are relative to the manifest. To change an existing edition, add `"id": "<edition id>"` to `edition` (the script prints the id when it creates one).
- The audiobook is never shown for sale until its edition is active and has files, otherwise the book page says "Audiobook coming soon".

## Before going live
Replace every `TODO(client)` text, set real prices, and check the book page on staging.


## Writing a book in the admin (no files, no scripts)
The owner can author a book in the browser instead of using the manifest above.

1. **Create the book** (title, address, author, format, price). It is a draft: `Edition.isActive` is false, so nothing is sold and nobody can see it.
2. **Add chapters** one at a time, or paste a whole manuscript where each chapter starts with a line `## Chapter title` (text before the first `## ` is ignored). Import is for ebooks and is refused on a live edition that readers already own.
3. **Audiobooks:** upload each chapter's MP3 or M4A (max 400 MB) from the chapter page. The browser sends it straight to the protected bucket (needs the CORS rule in `docs/R2_SETUP.md`); the server then checks the file exists and that its size fits the length you typed (64 to 400 kbps) before attaching it.
4. **Preview** a draft as a reader with `/dashboard/books/<slug>/read?preview=<editionId>` (admins only; nothing is saved).
5. **Publish.** It is refused while anything blocks it: price not above zero, no chapters, an ebook chapter with no text, an audiobook chapter with no audio or length, or chapter numbers with gaps. A missing free-preview chapter is only a warning.

Rules to know: a reason (10+ characters) is only asked for once the edition is live or someone owns it. Chapters cannot be moved or deleted (only the last one can be deleted) once any reader has a saved place or bookmark in the book; text can still be edited. Owners of an edition that is later retired keep reading and listening. Every change is written to the audit log with word counts and a hash, never the chapter text.