# Phase 4: Library, reader, listening and progress

Branch: `phase/4-library-reader-listening` (from `phase/3-money-path`).

## What was built
- **My Books** (`/dashboard/books`, Figma "My dashboard"): everything the person owns (Entitlement joined with Edition, Work, their saved position and bookmark count), Continue Reading and Continue Listening rows, filters by format and by not started, in progress and completed (98 percent and above). Cards show real data only (no ratings or view counts).
- **Reader** (`/dashboard/books/[slug]/read`, Figma "The Book"): the server checks session and purchase and sends ONE chapter; the browser pours it into columns so the pages fit this screen and font (a phone showed 39 to 87 pages for a chapter that takes 21 on a laptop). Saved position is "chapter:word" so every device agrees; resume, bookmark links and "previous chapter lands on its last page" all use it. Keyboard arrows, swipe, A- / A+ text size (remembered), "Page X of about Y" estimated for the whole book.
- **Progress saving**: `POST /api/reading/progress` (zod, owner check, rate limit; the server computes the percentage from chapter lengths, never the browser). Saves every 30 s when the position changed, when the tab is hidden, on `pagehide` via `sendBeacon`, and when leaving the reader.
- **Bookmarks** (`/api/bookmarks` GET/POST/DELETE, owner checked, idempotent) and `/dashboard/bookmarks`.
- **Listening page** (`/dashboard/books/[slug]/listen`), redesigned on your request: where the reader shows "Page 50 of 200", the audiobook has a music-app player bar (previous, back 10 s, play/pause, forward 10 s, next, seek bar with elapsed and remaining time, speed). The chapter text is large and READ ALONG: words already spoken (and the one being spoken) turn black, the words still to come stay faint, the view follows the voice and stops following for 4 s when you scroll, and clicking a word jumps the audio there. Cover and chapter list on the right (a Chapters button on phones).
- **Audio delivery**: `GET /api/media/chapter` and `POST /api/media/refresh` re-check the purchase every time and return a short-lived signed R2 URL (chapter length plus 5 minutes, minimum 10, maximum 3 hours). One `<audio>` element lives in the dashboard layout (`AudioHost`) so listening continues while browsing, with a mini player on other pages. It swaps in a fresh link at 80 percent of the old link's life without losing position, saves listening progress, and drives the lock-screen controls (Media Session). The play/pause button follows the real element state.
- **Other dashboard pages**: notifications with a bell (unread count polled every 60 s) and mark-all-read; My Activity (stats from saved positions plus your own sign-in log); Settings (name, notification choices, authenticator-app two-step with QR and backup codes, sign out everywhere). The sidebar links are all real, and on phones the sidebar becomes a menu drawer.
- The book page now shows "Read now" / "Listen now" when you already own the edition.

## Concepts
- **Signed URL** (a hotel key card that stops working at checkout time): a link to a private file that expires; we hand a new one out only after re-checking the purchase.
- **Device-independent position** (a bookmark that says "page where the word 'rain' is" instead of "page 12"): saving the word makes every device agree.
- **Read-along timing**: with no recording-aligned timing file, each word's time is estimated from its length plus pauses at punctuation. It follows the narration closely; exact timings can replace it later without changing the player.

## Tested
- Unit: locator and percentages, read-along timing (5 tests), audio link lifetime. Database: saving progress only for owners, audio links only for the audiobook owner and gone after a refund (removed entitlement), library data. 62 tests pass with a local database.
- Real routes: progress 401 / 404 / 400 / 200 and the saved row (`1:700`, 50 percent), bookmarks incl. not-owned 404, media links for owner vs non-owner vs ebook vs signed-out, notifications unread count.
- Real browsers (visible headless Chrome with autoplay): the player played, paused, skipped ±10 s, dragged the seek bar, went to the next chapter, auto-advanced at the end, changed speed; with your `Dedication.mp3` (79 s) the read-along highlighted 41 percent of the words at 41 percent of the time, and the current words stayed on screen. Reader: resume at the saved word, next/previous, keyboard, text-size re-flow keeps the place, and the saved position after the 30 s sync was `1:693`. Screenshots of reader (desktop and phone), listening page and library checked. `tsc`, `eslint`, tests and the production build pass.

## Mistakes avoided
Measuring pages needs the real screen, so the reader renders in the browser only (no server/browser mismatch). The player's buttons come from the audio element's events, not from guesses. A refund stops new audio links at once because every link request re-checks the purchase. Pure reading helpers were split out so tests do not need a database.

## Check yourself
1. `pnpm dev`; sign in; open My Books, open the reader on a phone-size window and a wide window and compare the page counts.
2. Listen page: press play, drag the bar, press +10s, and watch the black words follow the voice.
3. Put the dedication text in `public/dev-audio/Dedication.txt` (plain text, blank line between paragraphs) and re-run the dev seed to see real text in the read-along.

## Not done or unverified
- **Read-along text for `Dedication.mp3`**: I cannot hear the recording, so the test audiobook uses placeholder words (marked `TODO(client)`). The sync is estimated, so on real narration it may drift by a second or two; exact word timings (from an alignment tool) would remove that.
- Real R2 signed playback was not run (no bucket); local development serves test audio from `/dev-audio` (ignored by git, refused in production).
- Two-step (authenticator) setup uses Better Auth's passwordless mode; I did not run a full enrolment with a phone app. Enforcing it for admins is Phase 5.
- Highlights word by word is smooth on a laptop; on very long chapters (thousands of words) it has not been profiled on a low-end phone.
- Notifications page has no per-item "mark read" click yet (mark all).

## Questions for you
- Can you share the text of the dedication (and later of each audio chapter)? A plain text file is enough.
- Should owners of an audiobook also get the ebook text read-along for the ebook edition (separate purchase today)?

## Next: Phase 5 (admin core)
