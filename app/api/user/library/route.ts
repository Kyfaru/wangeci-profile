import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/mock-auth";
import { getLibraryForUser, type LibraryFormat, type LibraryStatus } from "@/lib/mock-user";

const VALID_FORMATS: LibraryFormat[] = ["ebook", "audiobook"];
const VALID_STATUSES: LibraryStatus[] = [
  "not-started",
  "in-progress",
  "completed",
];

/**
 * GET /api/user/library?format=&status=
 *
 * Requires a session (mirrors the real backend gating a signed-in user's
 * dashboard data). `format` and `status` are optional filters.
 */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format");
  const status = request.nextUrl.searchParams.get("status");

  let items = getLibraryForUser(userId);

  if (format && VALID_FORMATS.includes(format as LibraryFormat)) {
    items = items.filter((item) => item.format === format);
  }

  if (status && VALID_STATUSES.includes(status as LibraryStatus)) {
    items = items.filter((item) => item.status === status);
  }

  return NextResponse.json({ items, total: items.length });
}
