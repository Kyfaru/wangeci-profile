import { NextResponse } from "next/server";
import { findUserByEmail, toPublicUser } from "@/lib/mock-user";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  encodeMockSessionToken,
} from "@/lib/server/mock-auth";

interface LoginBody {
  email: string;
  password: string;
}

function isValidBody(value: unknown): value is LoginBody {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.email === "string" && typeof v.password === "string";
}

/**
 * POST /api/auth/login — MOCK STUB, not real auth.
 *
 * Plaintext password comparison against lib/mock-user.ts fixtures, and a
 * base64 JSON "token" with no signature. This exists purely so /dashboard
 * can gate realistically during local UI development. Real auth (hashing,
 * signed sessions) is Better Auth's job on the backend session — nothing
 * here is a security boundary.
 *
 * Demo credentials: demo@wangechi.test / password123
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const user = findUserByEmail(body.email);
  if (!user || user.passwordMock !== body.password) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = encodeMockSessionToken({
    userId: user.id,
    issuedAt: Date.now(),
  });

  const response = NextResponse.json({ user: toPublicUser(user) });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}
