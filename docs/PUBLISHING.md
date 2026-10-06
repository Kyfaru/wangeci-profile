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
- **Audiobook** (`"format": "AUDIOBOOK"`): each chapter has `"audio": "ch1.mp3"` (or `.m4a`) and `"durationSeconds"`. Files should be 192 to 320 kbps, constant bitrate, with the index at the start of the file (ffmpeg `-movflags +faststart` for m4a) so scrubbing is exact. If `ffprobe` is installed the script warns about other bitrates. Audio goes to the PROTECTED bucket only.
- Paths are relative to the manifest. To change an existing edition, add `"id": "<edition id>"` to `edition` (the script prints the id when it creates one).
- The audiobook is never shown for sale until its edition is active and has files, otherwise the book page says "Audiobook coming soon".

## Before going live
Replace every `TODO(client)` text, set real prices, and check the book page on staging.
