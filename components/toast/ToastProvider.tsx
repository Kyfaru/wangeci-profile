"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ToastCard, type ToastVariant } from "./ToastCard";

const DURATION_MS = 5000;
const MAX_VISIBLE = 5;

type ToastItemData = { id: number; variant: ToastVariant; title: string; description?: string };
type Notify = (title: string, description?: string) => void;
type ToastApi = Record<ToastVariant, Notify>;

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 0;

/** `const toast = useToast(); toast.success("Saved", "Your changes are live")` */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

function ToastItem({
  toast,
  dismiss,
}: {
  toast: ToastItemData;
  dismiss: (id: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  // Auto-dismiss; hovering pauses (and restarts) the clock.
  useEffect(() => {
    if (hovered) return;
    const t = setTimeout(() => dismiss(toast.id), DURATION_MS);
    return () => clearTimeout(t);
  }, [hovered, dismiss, toast.id]);

  return (
    <motion.div
      layout
      role={toast.variant === "error" ? "alert" : "status"}
      initial={{ opacity: 0, x: 80 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <ToastCard
        variant={toast.variant}
        title={toast.title}
        description={toast.description}
        onClose={() => dismiss(toast.id)}
      />
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItemData[]>([]);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );

  const api = useMemo<ToastApi>(() => {
    const make =
      (variant: ToastVariant): Notify =>
      (title, description) =>
        setToasts((all) => [...all, { id: nextId++, variant, title, description }].slice(-MAX_VISIBLE));
    return {
      success: make("success"),
      error: make("error"),
      warning: make("warning"),
      info: make("info"),
    };
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-3 [&>*]:pointer-events-auto">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} dismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
