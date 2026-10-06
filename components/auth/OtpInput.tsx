"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

/**
 * One box per digit. Typing moves forward, Backspace moves back, arrows move, and pasting a whole
 * code fills every box. Calls onComplete once all digits are in.
 */
export function OtpInput({
  length,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  const update = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };

  return (
    <div className="flex gap-3" role="group" aria-label={`${length}-digit code`}>
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={value[i] ?? ""}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid || undefined}
          disabled={disabled}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, "").slice(-1);
            update(value.slice(0, i) + digit + value.slice(i + 1));
            if (digit) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i]) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            update(e.clipboardData.getData("text"));
            refs.current[Math.min(length - 1, e.clipboardData.getData("text").replace(/\D/g, "").length)]?.focus();
          }}
          className={cn(
            "size-[72px] rounded-2xl border bg-white text-center font-display text-3xl text-navy outline-none transition-colors focus:border-blue focus:ring-2 focus:ring-blue/30 disabled:opacity-50",
            invalid ? "border-error" : "border-line",
          )}
        />
      ))}
    </div>
  );
}
