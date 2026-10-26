import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { api, logError } from "@/lib/trace";

// Without this the route could be run once at `next build` and cached, executing the database query (and
// lib/env.ts's eager validation) in the Docker build stage, which has no secrets.
export const dynamic = "force-dynamic";

/**
 * GET /api/health: liveness/readiness probe. 200 `{status: "ok", ts}` when the database answers, 503
 * `{status: "error"}` when it does not. The failure detail goes to the log, never to the caller.
 */
async function handleGET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
  } catch (error) {
    // An operational signal for the monitor, not a crash: answer 503 instead of an opaque 500.
    logError("health.db", error);
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}

export const GET = api("health.get", handleGET);
