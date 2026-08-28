"use client";

/**
 * /login — matches the reference split-screen spec (recolored into the
 * navy/gold/cream palette) via `AuthShell`.
 *
 * Client-side form state + validation, POSTs to the mock `/api/auth/login`
 * route via `apiClient`. On success the `['session']` query is invalidated
 * so `useSession()` refetches everywhere it's mounted, then the user is
 * redirected to `/dashboard`. OAuth buttons are UI-only for this phase —
 * see `handleOAuthClick` below.
 */
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AuthShell } from "@/components/layout";
import { Button, FormField, Input, OAuthButtonRow } from "@/components/ui";
import { apiClient, ApiError } from "@/lib/api/client";
import type { MockUser } from "@/lib/mock-user";

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginResponse {
  user: MockUser;
}

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const loginMutation = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiClient.post<LoginResponse>("/auth/login", body),
    onSuccess: async () => {
      // Session cookie is already set by the API response — refetch the
      // cached session everywhere useSession() is mounted, then redirect.
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
      console.error("[login] request failed", error);
    },
  });

  function validate(): FieldErrors {
    const errors: FieldErrors = {};
    if (!email.trim()) {
      errors.email = "Email is required";
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      errors.email = "Enter a valid email address";
    }
    if (!password) {
      errors.password = "Password is required";
    }
    return errors;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    loginMutation.mutate({ email: email.trim(), password });
  }

  function handleOAuthClick(provider: string) {
    // UI-only per the plan — no real OAuth wiring yet.
    console.info(`[login] OAuth click: ${provider} (not wired up)`);
    setOauthNotice(
      "Social sign-in is coming soon — please use your email and password for now."
    );
  }

  return (
    <AuthShell
      activeTab="login"
      title="Welcome back"
      description="Sign in to continue your reading journey."
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
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

        <FormField id="password" label="Password" required error={fieldErrors.password}>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            invalid={Boolean(fieldErrors.password)}
            onChange={(e) => setPassword(e.target.value)}
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
          loading={loginMutation.isPending}
        >
          Sign In
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
        New here? Create an account to save your progress, unlock exclusive
        chapters, and join the community around{" "}
        <span className="font-medium text-navy">From Pieces To Power</span>.
      </p>
    </AuthShell>
  );
}
