# Phase 2: Catalogue, chapters, store and the public pages

Branch: `phase/2-catalogue-public` (from `phase/1-database-identity`).

## What was built
- **Real catalogue**: `lib/catalogue.ts` builds the book list and book pages from Work, Edition, Asset and Chapter. Only active ebook and audiobook editions are sold (paperback is ignored). Each edition has its own price. The old fixture file `lib/mock-books.ts` and the lint exceptions for it are gone, so production code can no longer import any fixture.
- **Pages**: `/store` (list), `/store/[slug]` (cover, synopsis, per-edition buy buttons, "Audiobook coming soon" when no active audio, free first chapter, schema.org `Book` data), `/about` (with `Person` data), `/services` (ventures plus the contact form), `/contact`, `/terms`, `/privacy`, `/refunds`, `/cookies` (all clearly marked as drafts awaiting lawyer review, mentioning the Kenya Data Protection Act 2019, processors and how to ask for deletion). Footer links, sign-up links, `sitemap.xml`, `robots.txt` (blocks everything unless `NEXT_PUBLIC_SITE_ENV=production`), canonical URLs and open-graph tags with the cover.
- **Free preview**: served only by `getFreePreview()`, whose database query itself filters on `isFreePreview`, so paid text can never come out of it. Used by the book page and `GET /api/books/[slug]/preview`.
- **Contact form**: zod validation, honeypot field, Cloudflare Turnstile check on the server, rate limits (5 an hour per IP, 3 a day per email), then the `SupportBridge` (a swappable seam). Today it puts a bell item in the admin inbox for every owner and support user (`notifyAdmins`, deduplicated) and emails the owner inbox (`CONTACT_INBOX_EMAIL`) when set.
- **Publishing**: `scripts/publish-edition.ts` (validates first, then creates Work, Edition, Chapters and Assets, uploads to R2, optional `--activate`; refuses a non-local database without `--yes`). Guides: `docs/PUBLISHING.md`, `docs/R2_SETUP.md`.
- The reader page now loads chapters from the database and still refuses anyone without an entitlement.
- Search is database-backed and rate-limited. Navbar links About, Store and Services are now live (Blog stays hidden until Phase 8).

## Concepts
- **Read model** (a shop window built from the stock room): pages read a clean `CatalogueBook` instead of raw database rows, so the database can change without touching pages.
- **Honeypot** (a trap): a hidden form field no person sees; bots fill it in and are silently ignored.
- **Seam** (a socket): `SupportBridge` is a socket; today the inbox is plugged in, later a help desk can be plugged in without rewriting the form.

## Tested
- Unit/database: `catalogue.test.ts` proves only free-preview text, only active digital editions and per-edition prices come out, and that a book with no active edition is hidden (34 tests with a local DB, 29 plus 5 skipped without).
- Real runs: all new pages return 200; sitemap lists the book pages; paid chapter text appears nowhere in the book page or the preview API; contact form: bad body 400, valid message 200 and exactly one bell row for the owner, honeypot silently ignored; publish script: dry run, database write with `--activate` (the demo book then showed in `/store`), remote-database guard. `tsc`, `eslint` and the build pass. Screenshots of `/store` and the book page checked.

## Mistakes avoided
Build with no database: the catalogue is read on demand and cached for 5 minutes (not at build). JSON-LD is escaped so database text cannot close the script tag. Fabricated content (invented bios, testimonials, ratings, a read-time) stays removed.

## Check yourself
1. `pnpm dev`, open `/store` and the book page. 2. Submit the form on `/contact`; as the owner the message will appear in the admin inbox when Phase 5 builds it (for now check the `notification_log` table). 3. Read `docs/PUBLISHING.md` and try `--dry-run` with your own manifest.

## Not done or unverified
- R2 buckets are not created (they need your Cloudflare account); see `docs/R2_SETUP.md`. The publish script's upload path has not been run against real R2.
- Open-graph images use the cover; generated social images are not built.
- Real content: synopsis, author story, services list, refund window, legal entity name, contact email and phone, social links, retention periods, and a lawyer review of the four legal pages.
- The 90-day purge of old contact notifications is not scheduled yet (the cron arrives in Phase 3).

## Questions for you
- Which email address should receive contact messages (`CONTACT_INBOX_EMAIL`)?
- Do you want a separate Blog link in the navbar now, or hidden until Phase 8?

## Next: Phase 3 (cart, checkout, payments and orders)
