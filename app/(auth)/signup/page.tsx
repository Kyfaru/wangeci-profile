"use client";

/**
 * /signup — rebuilt to match `/login`'s full-bleed split layout (per an
 * explicit follow-up request after the initial passwordless build, which
 * had left `/signup` on the older card-style `AuthShell`). Same pinned
 * top-left mark, pill Sign In/Sign Up switcher, headline/subtext
 * treatment, flat-blue primary button, divider, circular Iconify OAuth
 * row, and right-column `AuthCarousel` as `/login` — just with the fuller
 * field set this page has always needed (name/country/county/phone).
 *
 * `AuthShell` (the floating card shell) is no longer used here — it's
 * left in place unmodified for any future auth page that still wants the
 * card treatment (e.g. `/verify`, `/reset-password`).
 *
 * Passwordless (plan §2A): no password field anywhere. Submitting sends
 * the collected email through the same email-OTP flow `/login` uses
 * (`authClient.emailOtp.sendVerificationOtp`) and opens `TwoFactorModal`,
 * rather than POSTing a password-based account to the mock
 * `/api/auth/signup` route.
 *
 * Judgment call: separate First name / Last name fields rather than one
 * Full Name field — reads as better UX for a first-time signup form.
 * These, plus country/county/phone, aren't sent anywhere yet (there's no
 * account-creation endpoint left to send them to once password auth is
 * gone) — they're captured in state and validated as before so the
 * field-level UX stays intact, ready to be wired into whatever
 * account-creation call the backend session ends up exposing alongside
 * the OTP verify.
 *
 * `CountrySelect`/`StateSelect`/`PhoneInput` below are the existing
 * `components/ui` primitives, reused as-is (not restyled to pixel-match
 * `/login`'s hand-rolled input treatment) — this file doesn't touch
 * `components/ui/**`, and rebuilding three data-driven form controls from
 * scratch to shave a few px of border-radius/color difference wasn't
 * worth the risk. They already share the navy/gold palette, so the
 * mismatch is minor.
 */
import { type FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  CountrySelect,
  FormField,
  StateSelect,
  PhoneInput,
  type CountryOption,
  type SelectOption,
} from "@/components/ui";
import { AppIcon } from "@/lib/icons";
import { authClient } from "@/lib/auth-client";
import { fetchStatesForCountry } from "@/lib/api/geo";
import countriesJson from "@/lib/countries.json";
import { AuthCarousel } from "@/components/auth/AuthCarousel";
import { TwoFactorModal } from "@/components/auth/TwoFactorModal";

const COUNTRIES = countriesJson as CountryOption[];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export default function SignupPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [countryIso2, setCountryIso2] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [stateOptions, setStateOptions] = useState<SelectOption[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);

  // Phone's country-code defaults/syncs from `countryIso2` above until the
  // user picks a different one directly on the phone field, after which it
  // stops following (see file header).
  const [phoneCountryIso2, setPhoneCountryIso2] = useState("");
  const [phoneCountryTouched, setPhoneCountryTouched] = useState(false);
  const [phone, setPhone] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  // Cascade: reset/re-fetch counties/states whenever the selected country
  // changes.
  //
  // The "reset stateValue/stateOptions and flip the loading flag" part is
  // deliberately done during render (comparing against a
  // previous-country snapshot kept in state) rather than as the first
  // statements of the effect below — this repo's `react-hooks/
  // set-state-in-effect` lint rule flags unconditional setState calls at
  // the top of an effect body, and this is React's own documented
  // pattern for "adjusting state when a prop/derived value changes"
  // without one. The effect itself is left to do only what effects are
  // actually for: the async fetch, with its setState calls tucked inside
  // the `.then()` callback rather than bare in the effect body.
  const [statesFetchedForCountry, setStatesFetchedForCountry] =
    useState(countryIso2);
  if (countryIso2 !== statesFetchedForCountry) {
    setStatesFetchedForCountry(countryIso2);
    setStateValue("");
    setStateOptions([]);
    setStatesError(null);
    setStatesLoading(Boolean(countryIso2));
  }

  useEffect(() => {
    if (!countryIso2) return;
    const country = COUNTRIES.find((c) => c.iso2 === countryIso2);
    if (!country) return;

    let cancelled = false;

    fetchStatesForCountry(country.name).then((result) => {
      if (cancelled) return;
      setStateOptions(
        result.states.map((s) => ({
          label: s.name,
          value: s.stateCode ?? s.name,
        }))
      );
      setStatesError(result.error);
      setStatesLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [countryIso2]);

  // The phone field's dial code mirrors the selected Country until the
  // user changes it independently on the phone field itself — derived
  // at render time (no effect/sync-state needed) so there's nothing to
  // reset when `countryIso2` changes.
  const effectivePhoneCountryIso2 = phoneCountryTouched
    ? phoneCountryIso2
    : countryIso2;

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (phone.trim() && !effectivePhoneCountryIso2) {
      errors.phone = "Select a country code for your phone number";
    }

    return errors;
  }

  // Collected for later — country/state/phone aren't sent anywhere in
  // this passwordless build (see file header), but derived here so
  // they're ready once an account-creation call exists to combine with
  // the OTP verify.
  function collectedFields() {
    const countryName = COUNTRIES.find((c) => c.iso2 === countryIso2)?.name;
    const dialCode = COUNTRIES.find(
      (c) => c.iso2 === effectivePhoneCountryIso2
    )?.dialCode;
    const combinedPhone =
      phone.trim() && dialCode
        ? `${dialCode}${phone.trim().replace(/\D/g, "")}`
        : undefined;

    return {
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email: email.trim(),
      country: countryName,
      state: stateValue || undefined,
      phone: combinedPhone,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const { email: trimmedEmail } = collectedFields();

    setSending(true);
    try {
      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: trimmedEmail,
        type: "sign-in",
      });
      if (error) {
        // Expected until the backend session wires up the emailOTP
        // plugin (see lib/auth-client.ts) — the modal still opens so the
        // OTP-entry UI stays exercisable ahead of that landing.
        console.warn("[signup] sendVerificationOtp failed", error);
      }
    } catch (err) {
      console.warn("[signup] sendVerificationOtp threw", err);
    } finally {
      setSending(false);
      setModalOpen(true);
    }
  }

  function handleOAuthClick(provider: string) {
    // UI-only per the plan — no real OAuth wiring yet.
    console.info(`[signup] OAuth click: ${provider} (not wired up)`);
  }

  function handleVerified() {
    queryClient.invalidateQueries({ queryKey: ["session"] });
    router.push("/dashboard");
  }

  return (
    <div className="grid min-h-screen w-screen grid-cols-1 overflow-hidden md:h-screen md:grid-cols-[46%_54%]">
      {/* Left column — this page has more fields than /login, so it scrolls
          within its own column on md+ instead of ever clipping content
          against the 100vh row height. */}
      <div className="relative flex flex-col bg-white p-6 md:overflow-y-auto md:p-0">
        {/* Pinned top-left mark — `sticky` rather than `/login`'s
            `absolute` (see file header: this page can scroll within its
            column on shorter viewports, and a sticky mark stays visible
            through that instead of scrolling away with the form). */}
        <Link
          href="/"
          className="static mb-8 inline-flex w-fit items-center gap-3 md:sticky md:top-10 md:left-10 md:mb-0 md:self-start"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-navy">
            <AppIcon icon="lucide:book-open" size={18} className="text-gold" />
          </span>
          <span className="text-base font-medium text-navy">
            Wangeci Kariuki
          </span>
        </Link>

        {/* Centered content block */}
        <div className="flex flex-1 items-center justify-center py-10 md:py-16">
          <div className="w-full max-w-[400px]">
            {/* Pill tab switcher */}
            <div className="inline-flex w-fit items-center gap-1 rounded-full bg-gray-light p-1">
              <Link
                href="/login"
                className="rounded-full px-5 py-2 text-sm font-medium text-gray transition-colors duration-150 hover:text-navy"
              >
                Sign In
              </Link>
              <span className="rounded-full bg-white px-5 py-2 text-sm font-medium text-navy shadow-sm">
                Sign Up
              </span>
            </div>

            <h1 className="mt-6 text-[32px] leading-tight font-bold text-navy">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-gray">
              Join to save your progress and unlock the full library.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-8 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="firstName"
                    className="mb-2 block text-sm font-medium text-navy"
                  >
                    First name
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    placeholder="Felister"
                    value={firstName}
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-line px-4 py-3 text-navy outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-gray focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,166,22,0.15)]"
                  />
                  {fieldErrors.firstName && (
                    <p className="mt-1.5 text-sm" style={{ color: "#B4321F" }}>
                      {fieldErrors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="lastName"
                    className="mb-2 block text-sm font-medium text-navy"
                  >
                    Last name
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    placeholder="Kariuki"
                    value={lastName}
                    aria-invalid={Boolean(fieldErrors.lastName)}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-line px-4 py-3 text-navy outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-gray focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,166,22,0.15)]"
                  />
                  {fieldErrors.lastName && (
                    <p className="mt-1.5 text-sm" style={{ color: "#B4321F" }}>
                      {fieldErrors.lastName}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-navy"
                >
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  aria-invalid={Boolean(fieldErrors.email)}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line px-4 py-3 text-navy outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-gray focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,166,22,0.15)]"
                />
                {fieldErrors.email && (
                  <p className="mt-1.5 text-sm" style={{ color: "#B4321F" }}>
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField id="country" label="Country">
                  <CountrySelect
                    id="country"
                    countries={COUNTRIES}
                    value={countryIso2}
                    onChange={setCountryIso2}
                  />
                </FormField>
                <FormField
                  id="state"
                  label="County / State"
                  hint={statesError ?? undefined}
                >
                  <StateSelect
                    id="state"
                    options={stateOptions}
                    value={stateValue}
                    onChange={setStateValue}
                    disabled={!countryIso2 || statesLoading}
                    placeholder={
                      !countryIso2
                        ? "Select a country first"
                        : statesLoading
                          ? "Loading…"
                          : "Select a county/state"
                    }
                  />
                </FormField>
              </div>

              <FormField id="phone" label="Phone number" error={fieldErrors.phone}>
                <PhoneInput
                  id="phone"
                  countries={COUNTRIES}
                  countryIso2={effectivePhoneCountryIso2}
                  onCountryChange={(iso2) => {
                    setPhoneCountryTouched(true);
                    setPhoneCountryIso2(iso2);
                  }}
                  value={phone}
                  onChange={setPhone}
                  invalid={Boolean(fieldErrors.phone)}
                />
              </FormField>

              {formError && (
                <p
                  role="alert"
                  className="rounded-lg px-4 py-2.5 text-sm"
                  style={{ color: "#B4321F", backgroundColor: "rgba(180,50,31,0.08)" }}
                >
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="mt-1 flex h-12 w-full items-center justify-center rounded-lg bg-blue text-base font-medium text-white transition-colors duration-150 hover:bg-blue-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                {sending ? (
                  <AppIcon
                    icon="lucide:loader-circle"
                    size={20}
                    className="animate-spin"
                  />
                ) : (
                  "Continue"
                )}
              </button>
            </form>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-line" />
              <span className="text-xs font-medium tracking-[0.05em] text-gray uppercase">
                Or Continue With
              </span>
              <div className="h-px flex-1 bg-line" />
            </div>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                aria-label="Continue with Google"
                onClick={() => handleOAuthClick("Google")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-gold"
              >
                <AppIcon icon="logos:google-icon" size={20} />
              </button>
              <button
                type="button"
                aria-label="Continue with Apple"
                onClick={() => handleOAuthClick("Apple")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-gold"
              >
                <AppIcon icon="ic:baseline-apple" size={20} className="text-black" />
              </button>
              <button
                type="button"
                aria-label="Continue with Facebook"
                onClick={() => handleOAuthClick("Facebook")}
                className="flex size-11 items-center justify-center rounded-full border border-line bg-white transition-colors duration-150 hover:border-gold"
              >
                <AppIcon icon="logos:facebook" size={20} />
              </button>
            </div>

            <p className="mt-8 text-center text-[13px] text-gray">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-gold hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right column — hidden below md, matches /login */}
      <div
        className="relative hidden overflow-hidden md:block"
        style={{ background: "linear-gradient(160deg, #0C2142 0%, #0F4FB1 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
        <AuthCarousel />
      </div>

      {modalOpen && (
        <TwoFactorModal
          onClose={() => setModalOpen(false)}
          email={email.trim()}
          initialStep="code"
          initialMethod="email"
          onVerified={handleVerified}
        />
      )}
    </div>
  );
}
