"use client";

import { useEffect } from "react";
import { cn } from "@seenlist/utils";
import { useDialogAnimation } from "@/lib/useDialogAnimation";

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
  const { mounted, handleClose } = useDialogAnimation(onDismiss);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div
        className={cn("absolute inset-0 bg-black/60 transition-opacity duration-200", mounted ? "opacity-100" : "opacity-0")}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* "Vidro" (mesmo padrão do dropdown de histórico do SearchBar.tsx) — fundo escuro translúcido + blur/saturação, em vez de `bg-surface` opaco. */}
      <div
        className={cn(
          "relative w-full max-w-[380px] rounded-xl border border-white/10 p-5 shadow-lg backdrop-blur-[18px] backdrop-saturate-[180%] transition-all duration-200 ease-out",
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        )}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)",
        }}
      >
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
