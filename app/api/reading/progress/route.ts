import { NextResponse } from "next/server";

interface ReadingProgressPayload {
  editionId: string;
  chapterIdx: number;
  scrollPosition?: number;
  charPosition?: number;
  timestamp?: number;
}

function isValidPayload(value: unknown): value is ReadingProgressPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.editionId === "string" && typeof v.chapterIdx === "number";
}

/**
 * POST /api/reading/progress
 *
 * Accepts `navigator.sendBeacon` payloads, which are sent as `text/plain`
 * or an opaque Blob (never `application/json`) and carry no auth header —
 * this endpoint is intentionally lenient on both. No session is required:
 * a real implementation would likely associate progress with a session
 * cookie when present and no-op (or queue) otherwise, but that's a judgment
 * call left to the real backend since sendBeacon requests can arrive after
 * the tab (and its ability to attach fresh headers) is already closing.
 */
export async function POST(request: Request) {
  let raw: unknown;

  try {
    // sendBeacon bodies arrive as text regardless of the Blob's declared
    // type, so always read as text first and parse manually rather than
    // relying on request.json() (which is strict about Content-Type).
    const text = await request.text();
    raw = text ? JSON.parse(text) : null;
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON (as text/plain or a JSON blob)" },
      { status: 400 }
    );
  }

  if (!isValidPayload(raw)) {
    return NextResponse.json(
      { error: "editionId (string) and chapterIdx (number) are required" },
      { status: 400 }
    );
  }

  // Mock: nowhere to persist this yet (no session-scoped progress store).
  // Real backend will upsert reading progress keyed by user + edition.
  return NextResponse.json({ ok: true, savedAt: new Date().toISOString() });
}
