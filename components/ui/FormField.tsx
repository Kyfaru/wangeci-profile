import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FormFieldProps {
  /** Associates the label with the control via htmlFor/id. */
  id?: string;
  label?: ReactNode;
  /** Shown below the control in muted text when there's no error. */
  hint?: ReactNode;
  /** Shown below the control in error color; takes priority over `hint`. */
  error?: ReactNode;
  required?: boolean;
  className?: string;
  /** The input/select/textarea/etc. this field wraps. */
  children: ReactNode;
}

/**
 * Label + control + helper/error message wrapper. Pass `invalid` to the
 * child control yourself (`FormField` only handles the label/message
 * chrome, so it works with any control — `Input`, `Select`, `PhoneInput`,
 * a custom widget, etc.).
 */
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
          {required && <span className="text-error ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : hint ? (
        <p className="text-sm text-gray">{hint}</p>
      ) : null}
    </div>
  );
}
