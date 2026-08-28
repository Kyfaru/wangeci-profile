"use client";

/**
 * /signup — same `AuthShell` as /login for shell consistency, with the
 * fuller field set from the plan.
 *
 * Judgment call: separate First name / Last name fields (joined into a
 * single `name` string client-side before POSTing) rather than one Full
 * Name field, since the mock `/api/auth/signup` route only accepts
 * `name: string`. Two fields preserves the plan's spec and reads as
 * better UX for a first-time signup form; see the final report for the
 * full reasoning.
 *
 * Country/County are optional (the API's `country` field is optional too)
 * — only email, password, and password confirmation are required. Phone
 * is optional, but if a local number is entered it must carry a country
 * code; `PhoneInput`'s own structure (a dial-code select paired with the
 * number field) makes a code-less phone number impossible to construct,
 * this form just guards the case where no code has been selected yet.
 */
import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthShell } from "@/components/layout";
import {
  Button,
  CountrySelect,
  FormField,
  Input,
  OAuthButtonRow,
  PhoneInput,
  StateSelect,
  type CountryOption,
  type SelectOption,
} from "@/components/ui";
import { apiClient, ApiError } from "@/lib/api/client";
import { fetchStatesForCountry } from "@/lib/api/geo";
import countriesJson from "@/lib/countries.json";
import type { MockUser } from "@/lib/mock-user";

const COUNTRIES = countriesJson as CountryOption[];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

interface SignupBody {
  name: string;
  email: string;
  password: string;
  country?: string;
  phone?: string;
}

interface SignupResponse {
  user: MockUser;
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

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  // Cascade: fetch counties/states whenever the selected country changes.
  useEffect(() => {
    setStateValue("");
    if (!countryIso2) {
      setStateOptions([]);
      setStatesError(null);
      return;
    }

    const country = COUNTRIES.find((c) => c.iso2 === countryIso2);
    if (!country) return;

    let cancelled = false;
    setStatesLoading(true);
    setStatesError(null);

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

  // Sync the phone field's dial code to the selected Country, unless the
  // user has already changed it independently on the phone field itself.
  useEffect(() => {
    if (!phoneCountryTouched && countryIso2) {
      setPhoneCountryIso2(countryIso2);
    }
  }, [countryIso2, phoneCountryTouched]);

  const signupMutation = useMutation({
    mutationFn: (body: SignupBody) =>
      apiClient.post<SignupResponse>("/auth/signup", body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      router.push("/dashboard");
    },
    onError: (error) => {
      const message =
        error instanceof ApiError
          ? error.message
          : "Something went wrong. Please try again.";
      setFormError(message);
      // TODO(api): swap for real error reporting (e.g. Sentry) once the
      // real auth backend replaces the mock route.
      console.error("[signup] request failed", error);
    },
  });

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!firstName.trim()) errors.firstName = "First name is required";
    if (!lastName.trim()) errors.lastName = "Last name is required";

    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }

    if (phone.trim() && !phoneCountryIso2) {
      errors.phone = "Select a country code for your phone number";
    }

    if (!password) {
      errors.password = "Password is required";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Confirm your password";
    } else if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    return errors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const countryName = COUNTRIES.find((c) => c.iso2 === countryIso2)?.name;
    const dialCode = COUNTRIES.find(
      (c) => c.iso2 === phoneCountryIso2
    )?.dialCode;
    const combinedPhone =
      phone.trim() && dialCode
        ? `${dialCode}${phone.trim().replace(/\D/g, "")}`
        : undefined;

    signupMutation.mutate({
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email: email.trim(),
      password,
      country: countryName,
      phone: combinedPhone,
    });
  }

  function handleOAuthClick(provider: string) {
    // UI-only per the plan — no real OAuth wiring yet.
    console.info(`[signup] OAuth click: ${provider} (not wired up)`);
    setOauthNotice(
      "Social sign-up is coming soon — please use the form for now."
    );
  }

  return (
    <AuthShell
      activeTab="signup"
      title="Create your account"
      description="Join to save your progress and unlock the full library."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField id="firstName" label="First name" required error={fieldErrors.firstName}>
            <Input
              id="firstName"
              name="firstName"
              autoComplete="given-name"
              placeholder="Felister"
              value={firstName}
              invalid={Boolean(fieldErrors.firstName)}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>
          <FormField id="lastName" label="Last name" required error={fieldErrors.lastName}>
            <Input
              id="lastName"
              name="lastName"
              autoComplete="family-name"
              placeholder="Kariuki"
              value={lastName}
              invalid={Boolean(fieldErrors.lastName)}
              onChange={(e) => setLastName(e.target.value)}
            />
          </FormField>
        </div>

        <FormField id="email" label="Email address" required error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            invalid={Boolean(fieldErrors.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            countryIso2={phoneCountryIso2}
            onCountryChange={(iso2) => {
              setPhoneCountryTouched(true);
              setPhoneCountryIso2(iso2);
            }}
            value={phone}
            onChange={setPhone}
            invalid={Boolean(fieldErrors.phone)}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          required
          error={fieldErrors.password}
          hint={fieldErrors.password ? undefined : "At least 8 characters"}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>

        <FormField
          id="confirmPassword"
          label="Confirm password"
          required
          error={fieldErrors.confirmPassword}
        >
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            invalid={Boolean(fieldErrors.confirmPassword)}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </FormField>

        {formError && (
          <p role="alert" className="rounded-xl bg-error/10 px-4 py-2.5 text-sm text-error">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={signupMutation.isPending}
        >
          Create Account
        </Button>
      </form>

      <div className="my-8 flex items-center gap-4">
        <div className="h-px flex-1 bg-navy/10" />
        <span className="text-xs font-medium tracking-[0.15em] text-gray uppercase">
          Or Continue With
        </span>
        <div className="h-px flex-1 bg-navy/10" />
      </div>

      <OAuthButtonRow
        onGoogleClick={() => handleOAuthClick("Google")}
        onAppleClick={() => handleOAuthClick("Apple")}
        onFacebookClick={() => handleOAuthClick("Facebook")}
      />
      {oauthNotice && (
        <p role="status" className="mt-4 text-center text-sm text-gray">
          {oauthNotice}
        </p>
      )}

      <p className="mt-10 text-center text-sm text-gray">
        By creating an account you join thousands of readers following
        Felister Wangechi Kariuki's journey in{" "}
        <span className="font-medium text-navy">From Pieces To Power</span>.
      </p>
    </AuthShell>
  );
}
