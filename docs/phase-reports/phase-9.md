# Phase 9: Public site fixes

Branch `phase/9-public-fixes` (from `phase/8-trace-errors`).

- Build break fixed: duplicate `StepUp` import in `ActionForm.tsx`.
- "Get My Book": the target page shows a "coming soon" panel (HTTP 200, noindex) when the featured book is not published, instead of a 404; the 404 page links to `/store`.
- Navbar: cart icon + badge on every page, dead search removed, `aria-current`, account icon says Dashboard when signed in, mobile menu closes on Escape/outside click with focus return and scroll lock, brand links home, hidden "Get My Book" at checkout.
- Hero: real CTAs. Footer: ventures link to services, cart/sign-in links, contact form link, no dead social anchors. Auth pages: mobile home link. `global-error.tsx` added. `/account` removed from protected prefixes.
- Content: `TODO(client)` text hidden in production; hardcoded prices removed; privacy/cookies mention optional services.
- Cart/checkout: removal also clears the server cart, dropped books are named, one price per line, mixed-currency guard, form with Enter submit, quote errors with Retry, skeletons, cancel-popup has no 15 s lock, "Cancel and check later" after 60 s, success page next steps, refund text, visible invoice errors.
- Checks: tsc, eslint clean; 161 tests; `pnpm build` passes; 20 Playwright pass, 4 skipped (need real provider secrets).

## Not done
Phone input has no `aria-invalid`; "Start reading" always links to the ebook reader (orders API returns no format); Resend errors log as "[object Object]" (fix in Phase 13); real contact details/socials still `TODO(client)`.
