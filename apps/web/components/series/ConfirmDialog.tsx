"use client";

import { useEffect } from "react";
import { cn } from "@seenlist/utils";

export interface ConfirmDialogAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "danger" | "default";
}

export interface ConfirmDialogProps {
  title: string;
  message?: string;
  actions: ConfirmDialogAction[];
  onDismiss: () => void;
}

const VARIANT_CLASS: Record<NonNullable<ConfirmDialogAction["variant"]>, string> = {
  primary: "bg-primary text-background font-semibold",
  danger: "bg-danger text-text font-semibold",
  default: "border border-border text-text",
};

/**
 * TASK-025 — usado tanto pra "marcar episódios anteriores?"
 * (Cancelar/Não/Sim, 3 botões) quanto pra confirmação de
 * temporada inteira (Cancelar/Marcar, 2 botões) — mesmo componente,
 * só muda a lista de `actions`.
 */
export function ConfirmDialog({ title, message, actions, onDismiss }: ConfirmDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} aria-hidden="true" />

      <div className="relative w-full max-w-[380px] rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-text">{title}</h2>
        {message && <p className="mt-2 text-sm text-muted">{message}</p>}

        <div className="mt-5 flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={cn(
                "rounded-lg px-4 py-2.5 text-sm transition-opacity hover:opacity-90",
                VARIANT_CLASS[action.variant ?? "default"]
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
