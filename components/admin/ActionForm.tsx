"use client";

import { useActionState, type ReactNode } from "react";

import type { ActionResult } from "@/app/admin/actions";
import { cn } from "@/lib/cn";

type Action = (prev: ActionResult | null, form: FormData) => Promise<ActionResult>;

/** A small form that runs one server action and shows its answer. Hidden fields carry the ids; `reason` is a typed text box. */
export function ActionForm({
  action,
  hidden,
  submitLabel,
  danger,
  reasonLabel = "Reason (kept in the audit log)",
  withReason = true,
  children,
}: {
  action: Action;
  hidden: Record<string, string>;
  submitLabel: string;
  danger?: boolean;
  reasonLabel?: string;
  withReason?: boolean;
  children?: ReactNode;
}) {
  const [result, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      {withReason && (
        <label className="block text-sm text-black/70">
          {reasonLabel}
          <textarea name="reason" required minLength={10} maxLength={500} rows={2} className="mt-1 w-full rounded-xl border-black/20 text-sm" />
        </label>
      )}
      <button
        type="submit"
        disabled={pending}
        className={cn("rounded-full px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50", danger ? "bg-error hover:bg-black" : "bg-navy hover:bg-gold")}
      >
        {pending ? "Working..." : submitLabel}
      </button>
      {result && (
        <p role="status" className={cn("text-sm", result.ok ? "text-green" : "text-error")}>
          {result.message}
        </p>
      )}
    </form>
  );
}
