"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@seenlist/utils";

type ToastVariant = "success" | "error";

interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;
let nextId = 0;

/**
 * TASK-026, item 3 — toasts de verdade em vez de `alert()` (que,
 * pra registro, este projeto nunca usou em lugar nenhum — não havia
 * o que substituir, mas o sistema em si não existia). Empilha até
 * 3 toasts visíveis, cada um some sozinho depois de 3s. Sem nenhuma
 * biblioteca nova — é só um contexto + uma lista renderizada por
 * cima de tudo.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (message: string, variant: ToastVariant) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-2), { id, message, variant }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const value: ToastContextValue = {
    success: (message: string) => push(message, "success"),
    error: (message: string) => push(message, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              "pointer-events-auto flex w-full max-w-[380px] items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg animate-toast-in",
              toast.variant === "success"
                ? "border-success/30 bg-surface text-text"
                : "border-danger/30 bg-surface text-text"
            )}
          >
            {toast.variant === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={2} />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-danger" strokeWidth={2} />
            )}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return context;
}
