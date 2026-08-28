import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

// Catch-all Route Handler for every Better Auth endpoint (sign-in, sign-up,
// session, email verification, password reset, etc.) — Better Auth owns the
// routing internally based on the path segment.
export const { GET, POST } = toNextJsHandler(auth);
