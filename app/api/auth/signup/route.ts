import { NextResponse } from "next/server";
import { createUser, findUserByEmail, toPublicUser } from "@/lib/mock-user";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  encodeMockSessionToken,
} from "@/lib/server/mock-auth";

interface SignupBody {
  name: string;
  email: string;
  password: string;
  country?: string;
  phone?: string;
}

function isValidBody(value: unknown): value is SignupBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === "string" &&
    typeof v.email === "string" &&
    typeof v.password === "string" &&
    v.name.trim().length > 0 &&
    v.password.length >= 8
  );
}

/**
 * POST /api/auth/signup — MOCK STUB, not real auth.
 *
 * Creates an in-memory user record (no hashing — see file-level note in
 * lib/mock-user.ts) and sets the same mock session cookie login does. Real
 * signup (validation, hashing, verification email, etc.) is Better Auth's
 * job on the backend session.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isValidBody(body)) {
    return NextResponse.json(
      {
        error:
          "name, email, and password (min 8 characters) are required",
      },
      { status: 400 }
    );
  }

  if (findUserByEmail(body.email)) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 }
    );
  }

  const user = createUser(body);

  const token = encodeMockSessionToken({
    userId: user.id,
    issuedAt: Date.now(),
  });

  const response = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
