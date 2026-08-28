import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Without this, Next.js could statically optimize this route (run it once
// at `next build` time and cache the result) since it uses no dynamic API
// on its own. That would execute prisma.$queryRaw — and therefore
// lib/env.ts's eager env validation — during the Docker build stage, which
// intentionally has no secrets available. See the webhook routes for the
// same guard.
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Liveness/readiness probe: confirms the process is up and can reach the
 * database.
 * @returns 200 with `{status: "ok", ts}` if the database responds, 503 with
 *   `{status: "error", error}` if it doesn't.
 * Why it exists: the deploy platform and any uptime monitor need a single
 * endpoint that fails loudly when the app can't talk to Postgres, instead
 * of surfacing as slow/broken behavior on real user requests.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
  } catch (error) {
    // A failed health check is an operational signal, not a crash — catch
    // it and return 503 so the monitor/orchestrator can act on it, rather
    // than the route throwing and returning an opaque 500.
    console.error("[health] database check failed", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
