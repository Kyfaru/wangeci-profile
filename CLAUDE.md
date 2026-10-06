@AGENTS.md

# Project rules (Wangeci platform)

Source of truth for scope: `docs/BUILD_BRIEF.md` (original) overridden by `docs/BUILD_BRIEF_AMENDMENTS.md`. Facts about the repo: `docs/reality-report.md`. Decisions: `docs/DECISIONS.md`. Phase reports: `docs/phase-reports/`.

## Commands (pnpm 11)
- `pnpm dev` (user may already own :3000; never run `pnpm build` or delete `.next` while it is up)
- `pnpm typecheck` (runs `next typegen` first), `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm check` (typecheck + lint + test)
- Prisma: `prisma validate` needs DATABASE_URL and DIRECT_URL set (CI uses placeholders). Never run migrations against staging/production without asking.

## Conventions
- Server decides money and access. Prices come from the database. Only a verified server-to-server event marks an order PAID/REFUNDED.
- `lib/server/session.ts` (`getSession`, `getSessionUserId`, `requireUser`) is the only way to read the session. Every protected page, route handler and server action re-checks it; `proxy.ts` is only the front door.
- All site identity (name, URL, contact) lives in `lib/site.ts`. Missing client content is `TODO(client)`, never invented.
- `lib/mock-*` fixtures are for tests and seeding only; ESLint blocks importing them from `app/`, `components/` and `lib/` (legacy exceptions listed in `eslint.config.mjs`, to be removed in Phase 2).
- Rate limits: `rateLimit(key, limit, window)` in `lib/rate-limit.ts`.
- Branches: one per phase, `phase/N-name`, each cut from the previous phase. `master` is production. Do not push or merge unless asked.

## Phase status
- Phase 0 (stabilise): done on `phase/0-stabilise`.
- Phase 1 (database + identity): done on `phase/1-database-identity`. Local DB: `pnpm db:dev`, `pnpm db:migrate`, `pnpm db:seed`; DB tests need TEST_DATABASE_URL.
- Phase 2 (catalogue, public pages): done on `phase/2-catalogue-public`. Publish books with `docs/PUBLISHING.md`.
- Phase 3 (money path): done on `phase/3-money-path`. Payment news always goes through `applyProviderEvent`; Daraja is unverified against official docs.
- Phase 4 onward: see `docs/phase-reports/`.
