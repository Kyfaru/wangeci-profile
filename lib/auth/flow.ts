/**
 * Where the person is in the sign-in / sign-up flow, kept in sessionStorage (this tab only) so
 * personal data never travels in a URL. Cleared when the flow ends.
 */
export interface Flow {
  mode: "signin" | "signup" | "complete";
  /** Which channel the first code went to. */
  via: "email" | "phone";
  /** The email or E.164 phone the code was sent to. */
  identifier: string;
  /** Sign-up only. */
  name?: string;
  /** Phone as typed on the sign-up page (dial code + local number) and as E.164. */
  phone?: string;
  phoneDial?: string;
  phoneLocal?: string;
  /** A same-site path to return to after sign-in (validated again with safeRedirect before use). */
  redirect?: string;
}

const KEY = "wc_flow";

export function saveFlow(flow: Flow): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(flow));
  } catch {
    /* private mode: the flow just restarts */
  }
}

export function loadFlow(): Flow | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Flow) : null;
  } catch {
    return null;
  }
}

export function clearFlow(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Turns a Better Auth client error into a sentence for the person. */
export function describeAuthError(error: { code?: string; message?: string; status?: number } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "INVALID_OTP":
      return "That code is not right. Please check it and try again.";
    case "OTP_EXPIRED":
      return "That code has expired. Request a new one.";
    case "TOO_MANY_ATTEMPTS":
      return "Too many wrong tries on that code. Request a new one.";
    case "OTP_LOCKED":
    case "OTP_SEND_LIMIT":
      return error.message ?? "Too many tries. Please wait a little.";
    case "BANNED_USER":
      return "This account cannot sign in. Contact support.";
    default:
      return error.status === 429 ? (error.message ?? "Too many requests. Please wait a little.") : (error.message ?? "Something went wrong. Please try again.");
  }
}
