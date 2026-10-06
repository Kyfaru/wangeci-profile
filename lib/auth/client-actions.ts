"use client";

import { authClient } from "@/lib/auth-client";

/** Sends a one-time code to an email or an E.164 phone number. `token` is the Turnstile result. */
export function sendCode(via: "email" | "phone", identifier: string, token: string | null) {
  const fetchOptions = token ? { headers: { "x-captcha-response": token } } : undefined;
  return via === "email"
    ? authClient.emailOtp.sendVerificationOtp({ email: identifier, type: "sign-in", fetchOptions })
    : authClient.phoneNumber.sendOtp({ phoneNumber: identifier, fetchOptions });
}

export const maskIdentifier = (value: string) =>
  value.includes("@") ? value.replace(/^(.).*(@.*)$/, "$1***$2") : `${value.slice(0, 5)}***${value.slice(-2)}`;

export const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-navy outline-none transition-colors placeholder:text-gray/60 focus:border-blue focus:ring-2 focus:ring-blue/30";

export const primaryButton =
  "flex h-[55px] w-full items-center justify-center gap-2 rounded-2xl bg-gold-bright text-lg font-medium text-black transition-[transform,box-shadow,opacity] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgb(253_193_5/0.35)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
