"use client";

/**
 * 2FA / OTP verification modal — shared by `/login` and `/signup`'s
 * passwordless flow (see the passwordless auth redesign plan, §2A).
 *
 * Three internal steps, all sharing one modal shell:
 *   - "method" — choose Email / SMS / Authenticator app.
 *   - "code"   — enter the 4-digit (email/SMS) or 6-digit (TOTP) code.
 *   - "enroll" — first-time TOTP setup (QR + 6-digit confirm in one step).
 *     Only reachable via `initialStep="enroll"` — no trigger UI for it
 *     exists yet (that lives in a future Settings/onboarding flow), but
 *     the modal supports the mode now per the spec.
 *
 * Callers that already know the destination (login/signup both send the
 * email OTP themselves *before* opening this modal) pass
 * `initialStep="code"` + `initialMethod="email"` to skip straight to code
 * entry instead of showing the method-choose step.
 *
 * Code entry uses the official `@preline/pin-input` plugin rather than a
 * hand-rolled box input — see its README at
 * `node_modules/@preline/pin-input/README.md` for the exact API this
 * wraps. Auto-advance-on-fill, backspace-moves-to-previous-box, and
 * paste-distributes-across-boxes are all built into the plugin; this
 * component only listens for `input`/`keyup` bubbling out of the
 * plugin-managed inputs to know when all boxes are filled (the plugin's
 * own `completed` event only fires, never un-fires, so it can't tell us
 * about a backspace clearing a previously-complete code).
 *
 * Wiring: see `lib/auth-client.ts`. Every `authClient.*` call here can
 * fail at runtime until the backend session adds the `emailOTP`/
 * `phoneNumber`/`twoFactor` server plugins to `lib/auth.ts` — expected
 * for now (flagged separately), handled here as a normal error state
 * ("Incorrect code. Try again.") rather than a crash.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { AppIcon } from "@/lib/icons";
import { authClient } from "@/lib/auth-client";
import { usePrefersReducedMotion } from "@/lib/hooks/use-prefers-reduced-motion";

export type TwoFactorMethod = "email" | "sms" | "totp";
export type TwoFactorStep = "method" | "code" | "enroll";

export interface TwoFactorModalProps {
  /** Callers mount this component conditionally (`{open && <TwoFactorModal
   * .../>}`) rather than passing an `open` boolean — every mount starts
   * fresh from `initialStep`/`initialMethod` for free, with no reset
   * effect needed. */
  onClose: () => void;
  /** Email captured on login/signup — used for the email-OTP calls and to
   * render the masked "j•••@gmail.com" destination. */
  email: string;
  /** Which step to open on. Defaults to "method". Login/signup pass
   * "code" since they already triggered the email OTP send themselves. */
  initialStep?: TwoFactorStep;
  /** Preselects a method, bypassing the localStorage/email default. */
  initialMethod?: TwoFactorMethod;
  /** Verified phone number on file, if any. Omitted (the common case for
   * a brand-new user) disables the SMS method card. */
  phoneNumber?: string;
  /** Whether the user has already enrolled an authenticator app. False
   * (the default) disables the TOTP method card — expected for every
   * new user, not a bug. */
  totpEnrolled?: boolean;
  /** Called after a successful verify/enroll, before the modal closes
   * itself. Use this to redirect, invalidate the session query, etc. */
  onVerified?: () => void;
}

const LAST_METHOD_STORAGE_KEY = "wangeci:2fa-last-method";
const RESEND_SECONDS = 45;
const CROSS_FADE_MS = 200;
const SHAKE_MS = 300;

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local[0]}•••@${domain}`;
}

/** Best-effort mask: dial code + first digit, bulleted middle, last 3
 * digits — approximates the spec's "+254 7•• •• 123" example without
 * assuming a specific national number length/grouping. */
function maskPhone(phone: string): string {
  const cleaned = phone.replace(/\s+/g, "");
  const dialMatch = cleaned.match(/^\+\d{1,3}/);
  const dialCode = dialMatch ? dialMatch[0] : "";
  const rest = cleaned.slice(dialCode.length);
  if (rest.length <= 3) return `${dialCode} ${"•".repeat(rest.length)}`.trim();
  const firstDigit = rest[0];
  const last3 = rest.slice(-3);
  const hiddenCount = Math.max(rest.length - 4, 2);
  return `${dialCode} ${firstDigit}${"•".repeat(hiddenCount)}${last3}`.trim();
}

function readStoredMethod(): TwoFactorMethod | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(LAST_METHOD_STORAGE_KEY);
    if (stored === "email" || stored === "sms" || stored === "totp") {
      return stored;
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to default.
  }
  return null;
}

function storeMethod(method: TwoFactorMethod) {
  try {
    window.localStorage.setItem(LAST_METHOD_STORAGE_KEY, method);
  } catch {
    // Non-fatal — just means the default resets next time.
  }
}

const inputBaseStyle: React.CSSProperties = {
  width: 56,
  height: 56,
};

export function TwoFactorModal({
  onClose,
  email,
  initialStep = "method",
  initialMethod,
  phoneNumber,
  totpEnrolled = false,
  onVerified,
}: TwoFactorModalProps) {
  const reducedMotion = usePrefersReducedMotion();

  const [step, setStep] = useState<TwoFactorStep>(initialStep);
  const [selectedMethod, setSelectedMethod] = useState<TwoFactorMethod>(
    initialMethod ?? readStoredMethod() ?? "email",
  );
  const [fading, setFading] = useState(false);

  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [otpComplete, setOtpComplete] = useState(false);
  const otpValueRef = useRef("");

  const [resendKey, setResendKey] = useState(0);

  const pinContainerRef = useRef<HTMLDivElement>(null);
  const pinInstanceRef = useRef<{ destroy: () => void } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const boxCount = step === "enroll" || selectedMethod === "totp" ? 6 : 4;

  const goToStep = useCallback(
    (next: TwoFactorStep) => {
      setError(null);
      if (reducedMotion) {
        setStep(next);
        return;
      }
      setFading(true);
      window.setTimeout(() => {
        setStep(next);
        setFading(false);
      }, CROSS_FADE_MS / 2);
    },
    [reducedMotion],
  );

  // Wire up the Preline PIN Input plugin whenever the "code"/"enroll"
  // step is showing. Re-runs on box-count change so switching between a
  // 4-box and 6-box layout gets a fresh instance bound to the new inputs.
  useEffect(() => {
    if (step !== "code" && step !== "enroll") return;

    let cancelled = false;
    let container: HTMLDivElement | null = null;

    function recompute() {
      if (!container) return;
      const items = Array.from(
        container.querySelectorAll<HTMLInputElement>(
          "[data-hs-pin-input-item]",
        ),
      );
      const values = items.map((el) => el.value);
      otpValueRef.current = values.join("");
      setOtpComplete(values.length > 0 && values.every((v) => v !== ""));
    }

    import("@preline/pin-input/non-auto").then(({ default: HSPinInput }) => {
      if (cancelled || !pinContainerRef.current) return;
      container = pinContainerRef.current;
      pinInstanceRef.current = new HSPinInput(container, {
        availableCharsRE: /^[0-9]+$/,
      });
      container.addEventListener("input", recompute);
      container.addEventListener("keyup", recompute);
    });

    return () => {
      cancelled = true;
      if (container) {
        container.removeEventListener("input", recompute);
        container.removeEventListener("keyup", recompute);
      }
      pinInstanceRef.current?.destroy();
      pinInstanceRef.current = null;
      otpValueRef.current = "";
      setOtpComplete(false);
    };
  }, [step, boxCount]);

  // Animate the modal container's height to fit whichever step is showing.
  useLayoutEffect(() => {
    if (!contentRef.current) return;
    setMaxHeight(contentRef.current.scrollHeight);
  }, [step, error, selectedMethod]);

  function triggerShake() {
    if (reducedMotion) return;
    setShake(true);
    window.setTimeout(() => setShake(false), SHAKE_MS);
  }

  async function sendCodeFor(method: TwoFactorMethod) {
    if (method === "totp") return; // no send step for TOTP
    if (method === "email") {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp(
        { email, type: "sign-in" },
      );
      if (sendError) {
        // Expected until the backend session wires up the emailOTP
        // plugin — logged, not surfaced, so the UI stays exercisable.
        console.warn("[TwoFactorModal] sendVerificationOtp failed", sendError);
      }
      return;
    }
    if (method === "sms" && phoneNumber) {
      const { error: sendError } = await authClient.phoneNumber.sendOtp({
        phoneNumber,
      });
      if (sendError) {
        console.warn("[TwoFactorModal] phoneNumber.sendOtp failed", sendError);
      }
    }
  }

  async function handleSendCode() {
    setSending(true);
    setError(null);
    try {
      await sendCodeFor(selectedMethod);
      storeMethod(selectedMethod);
      goToStep("code");
    } finally {
      setSending(false);
    }
  }

  async function handleResend() {
    await sendCodeFor(selectedMethod);
    setResendKey((k) => k + 1);
  }

  async function verifyEnteredCode(): Promise<{ error?: unknown }> {
    const code = otpValueRef.current;
    if (step === "enroll") {
      return authClient.twoFactor.verifyTotp({ code });
    }
    if (selectedMethod === "email") {
      return authClient.signIn.emailOtp({ email, otp: code });
    }
    if (selectedMethod === "sms") {
      return authClient.phoneNumber.verify({
        phoneNumber: phoneNumber ?? "",
        code,
      });
    }
    return authClient.twoFactor.verifyTotp({ code });
  }

  async function handleVerify() {
    setVerifying(true);
    setError(null);
    try {
      const result = await verifyEnteredCode();
      if (result?.error) {
        setError(
          step === "enroll"
            ? "Incorrect code. Try again."
            : "Incorrect code. Try again.",
        );
        triggerShake();
        return;
      }
      storeMethod(selectedMethod);
      onVerified?.();
      onClose();
    } catch (err) {
      // Expected pre-backend (the endpoint doesn't exist yet) — surfaced
      // as the same "incorrect code" state so the flow stays testable.
      console.error("[TwoFactorModal] verify failed", err);
      setError("Incorrect code. Try again.");
      triggerShake();
    } finally {
      setVerifying(false);
    }
  }

  const codeStepDestination =
    selectedMethod === "totp"
      ? null
      : selectedMethod === "email"
        ? maskEmail(email)
        : maskPhone(phoneNumber ?? "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — intentionally has no onClick. Click-outside must NOT
          close the modal per spec; only the X button or a completed/
          cancelled flow does. */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={
          step === "enroll" ? "Set up your authenticator app" : "Verify it's you"
        }
        className="relative w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 text-gray transition-colors hover:text-navy"
        >
          <AppIcon icon="lucide:x" size={20} />
        </button>

        <div
          className="overflow-hidden"
          style={{
            maxHeight,
            transition: reducedMotion ? "none" : "max-height 300ms ease",
          }}
        >
          <div
            ref={contentRef}
            style={{
              opacity: fading ? 0 : 1,
              transition: reducedMotion
                ? "none"
                : `opacity ${CROSS_FADE_MS}ms ease`,
            }}
          >
            {step === "method" && (
              <MethodStep
                email={email}
                phoneNumber={phoneNumber}
                totpEnrolled={totpEnrolled}
                selectedMethod={selectedMethod}
                onSelect={setSelectedMethod}
                onSubmit={handleSendCode}
                sending={sending}
              />
            )}

            {step === "code" && (
              <CodeStep
                method={selectedMethod}
                destination={codeStepDestination}
                boxCount={boxCount}
                pinContainerRef={pinContainerRef}
                otpComplete={otpComplete}
                verifying={verifying}
                error={error}
                shake={shake}
                resendKey={resendKey}
                onResendClick={handleResend}
                onVerify={handleVerify}
                onUseDifferentMethod={() => goToStep("method")}
              />
            )}

            {step === "enroll" && (
              <EnrollStep
                boxCount={boxCount}
                pinContainerRef={pinContainerRef}
                otpComplete={otpComplete}
                verifying={verifying}
                error={error}
                shake={shake}
                onConfirm={handleVerify}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step "method" — choose Email / SMS / Authenticator app.
// ---------------------------------------------------------------------------

interface MethodStepProps {
  email: string;
  phoneNumber?: string;
  totpEnrolled: boolean;
  selectedMethod: TwoFactorMethod;
  onSelect: (method: TwoFactorMethod) => void;
  onSubmit: () => void;
  sending: boolean;
}

function MethodStep({
  email,
  phoneNumber,
  totpEnrolled,
  selectedMethod,
  onSelect,
  onSubmit,
  sending,
}: MethodStepProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-navy">Verify it&apos;s you</h2>
      <p className="mt-1 text-sm text-gray">
        Choose how you&apos;d like to receive your code.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        <MethodCard
          icon="lucide:mail"
          label="Email"
          description={`Send code to ${maskEmail(email)}`}
          selected={selectedMethod === "email"}
          disabled={false}
          onClick={() => onSelect("email")}
        />
        <MethodCard
          icon="lucide:smartphone"
          label="SMS"
          description={
            phoneNumber
              ? `Send code to ${maskPhone(phoneNumber)}`
              : "Add a phone number in Settings to use this option"
          }
          selected={selectedMethod === "sms"}
          disabled={!phoneNumber}
          onClick={() => onSelect("sms")}
        />
        <MethodCard
          icon="lucide:shield-check"
          label="Authenticator app"
          description={
            totpEnrolled
              ? "Use your authenticator app"
              : "Set this up in Settings after signing in"
          }
          selected={selectedMethod === "totp"}
          disabled={!totpEnrolled}
          onClick={() => onSelect("totp")}
        />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={sending}
        className="mt-6 h-12 w-full rounded-lg bg-blue text-base font-medium text-white transition-colors duration-150 hover:bg-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "Sending…" : "Send code"}
      </button>
    </div>
  );
}

interface MethodCardProps {
  icon: Parameters<typeof AppIcon>[0]["icon"];
  label: string;
  description: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}

function MethodCard({
  icon,
  label,
  description,
  selected,
  disabled,
  onClick,
}: MethodCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border p-4 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? "var(--gold)" : "var(--line)",
        backgroundColor: selected ? "rgba(212,166,22,0.04)" : "white",
      }}
    >
      <AppIcon
        icon={icon}
        size={20}
        className={selected ? "text-gold shrink-0" : "text-navy shrink-0"}
      />
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-navy">
          {label}
        </span>
        <span className="mt-0.5 block text-sm text-gray">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center rounded-full border"
        style={{ borderColor: selected ? "var(--gold)" : "var(--line)" }}
      >
        {selected && (
          <span className="size-2 rounded-full bg-gold" aria-hidden="true" />
        )}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step "code" — enter the OTP.
// ---------------------------------------------------------------------------

interface CodeStepProps {
  method: TwoFactorMethod;
  destination: string | null;
  boxCount: number;
  pinContainerRef: React.RefObject<HTMLDivElement | null>;
  otpComplete: boolean;
  verifying: boolean;
  error: string | null;
  shake: boolean;
  /** Bumped by the parent on every manual resend, forcing `ResendTimer`
   * to remount (and its 45s countdown to restart) via its `key`. */
  resendKey: number;
  onResendClick: () => void;
  onVerify: () => void;
  onUseDifferentMethod: () => void;
}

function CodeStep({
  method,
  destination,
  boxCount,
  pinContainerRef,
  otpComplete,
  verifying,
  error,
  shake,
  resendKey,
  onResendClick,
  onVerify,
  onUseDifferentMethod,
}: CodeStepProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-navy">
        Enter verification code
      </h2>
      <p className="mt-1 text-sm text-gray">
        {destination
          ? `We sent a code to ${destination}`
          : "Enter the 6-digit code from your authenticator app."}
      </p>

      <div
        ref={pinContainerRef}
        data-hs-pin-input
        className="mt-6 flex justify-center gap-3 shake-target"
        data-shake={shake || undefined}
      >
        {Array.from({ length: boxCount }).map((_, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            data-hs-pin-input-item
            style={inputBaseStyle}
            className="rounded-lg border border-line text-center text-2xl font-bold text-navy outline-none transition-[border-color,box-shadow] duration-150 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,166,22,0.15)]"
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm" style={{ color: "#B4321F" }}>
          {error}
        </p>
      )}

      {method !== "totp" && (
        <p className="mt-4 text-center text-[13px]">
          <ResendTimer key={resendKey} onResendClick={onResendClick} />
        </p>
      )}

      <button
        type="button"
        onClick={onVerify}
        disabled={!otpComplete || verifying}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-blue text-base font-medium text-white transition-colors duration-150 hover:bg-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {verifying ? (
          <AppIcon icon="lucide:loader-circle" size={20} className="animate-spin" />
        ) : (
          "Verify & sign in"
        )}
      </button>

      <button
        type="button"
        onClick={onUseDifferentMethod}
        className="mt-4 block w-full text-center text-[13px] font-medium text-gray hover:text-navy"
      >
        ← Use a different method
      </button>
    </div>
  );
}

/**
 * Owns its own 45s countdown, remounted fresh (via the parent's `key`)
 * whenever the countdown needs restarting — entering the code step, or a
 * manual resend. Keeping the "start over at 45" reset implicit in the
 * remount means the interval effect below never needs to call setState
 * synchronously in its body (only inside the `setInterval` tick
 * callback), which is what this repo's `react-hooks/set-state-in-effect`
 * rule requires.
 */
function ResendTimer({ onResendClick }: { onResendClick: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  if (secondsLeft > 0) {
    return (
      <span className="text-gray">
        Resend code in 0:{secondsLeft.toString().padStart(2, "0")}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onResendClick}
      className="font-medium text-gold hover:underline"
    >
      Resend code
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step "enroll" — first-time TOTP setup (QR + confirm in one step).
// ---------------------------------------------------------------------------

interface EnrollStepProps {
  boxCount: number;
  pinContainerRef: React.RefObject<HTMLDivElement | null>;
  otpComplete: boolean;
  verifying: boolean;
  error: string | null;
  shake: boolean;
  onConfirm: () => void;
}

function EnrollStep({
  boxCount,
  pinContainerRef,
  otpComplete,
  verifying,
  error,
  shake,
  onConfirm,
}: EnrollStepProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-navy">
        Set up your authenticator app
      </h2>
      <p className="mt-1 text-sm text-gray">
        Scan the QR code, then enter the 6-digit code to confirm.
      </p>

      {/* QR placeholder — the real data URI comes from
          `authClient.twoFactor.getTotpUri()` (called during enrollment,
          not built here since there's no enrollment trigger UI yet). */}
      <div className="mt-6 flex justify-center">
        <div className="flex size-[180px] items-center justify-center rounded-lg border border-line bg-gray-light">
          <AppIcon icon="lucide:qr-code" size={64} className="text-gray" />
        </div>
      </div>

      <div
        ref={pinContainerRef}
        data-hs-pin-input
        className="mt-6 flex justify-center gap-3 shake-target"
        data-shake={shake || undefined}
      >
        {Array.from({ length: boxCount }).map((_, i) => (
          <input
            key={i}
            type="text"
            inputMode="numeric"
            maxLength={1}
            data-hs-pin-input-item
            style={inputBaseStyle}
            className="rounded-lg border border-line text-center text-2xl font-bold text-navy outline-none transition-[border-color,box-shadow] duration-150 focus:border-gold focus:shadow-[0_0_0_3px_rgba(212,166,22,0.15)]"
          />
        ))}
      </div>

      {error && (
        <p className="mt-3 text-center text-sm" style={{ color: "#B4321F" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onConfirm}
        disabled={!otpComplete || verifying}
        className="mt-6 flex h-12 w-full items-center justify-center rounded-lg bg-blue text-base font-medium text-white transition-colors duration-150 hover:bg-blue-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {verifying ? (
          <AppIcon icon="lucide:loader-circle" size={20} className="animate-spin" />
        ) : (
          "Confirm & enable"
        )}
      </button>
    </div>
  );
}
