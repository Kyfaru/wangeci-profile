# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Builder
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

# openssl is required by Prisma's query engine on Alpine (musl) — without it
# the engine binary fails at runtime with "Error loading shared library
# libssl.so". libc6-compat covers other native addons that expect glibc.
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Pin pnpm to the version declared in package.json's "packageManager" field.
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate

# Install dependencies first so this layer is cached unless the lockfile
# or manifest changes. pnpm-workspace.yaml is required here too: it holds
# the allowBuilds approvals pnpm needs to run native postinstall scripts
# (@prisma/client, prisma, esbuild, etc.) non-interactively.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Now copy the rest of the source and build.
COPY . .

# Generate the Prisma client explicitly — don't rely solely on the
# postinstall hook in case of ordering issues in this stage.
RUN pnpm exec prisma generate

# `pnpm build` runs `prisma generate && next build` (Turbopack, default in
# Next.js 16). NOTE: next build must succeed with NO runtime secrets present
# (DATABASE_URL, PAYSTACK_*, R2_*, etc. are intentionally not passed as build
# args — see report). If any page/route starts importing lib/env.ts
# (directly or via lib/prisma.ts / lib/auth.ts) and gets statically
# prerendered, this step will start failing at build time.
RUN pnpm build

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat openssl dumb-init

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

WORKDIR /app

# Dedicated non-root user/group.
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Standalone server output (includes a pruned node_modules + server.js).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets are not included in the standalone trace and must be copied
# in manually, alongside the standalone output's own .next dir.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Public assets (public/ exists in this repo — verified before writing this).
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma's generated client + native query engine binary. Next's standalone
# output tracing does not reliably capture Prisma's query engine binary
# (a common gotcha), so copy the generated client directory explicitly.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs

EXPOSE 3000

# Depends on GET /api/health existing and returning 200 — that route does
# not exist in this repo yet (another agent is adding it in parallel). This
# HEALTHCHECK will report unhealthy until it lands.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(r.status!==200)process.exit(1);process.exit(0)}).catch(()=>process.exit(1))"

# dumb-init as PID 1 so SIGTERM is forwarded correctly for graceful shutdown
# (drain in-flight requests) instead of Node handling PID 1 signal semantics
# directly.
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
