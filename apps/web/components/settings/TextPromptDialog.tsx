"use client";

import { useEffect, useState } from "react";
import { cn } from "@seenlist/utils";
import { useDialogAnimation } from "@/lib/useDialogAnimation";

export interface TextPromptField {
  name: string;
  label: string;
  type?: "text" | "password";
  placeholder?: string;
  defaultValue?: string;
}

export interface TextPromptDialogProps {
  title: string;
  fields: TextPromptField[];
  submitLabel: string;
  cancelLabel: string;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
  onDismiss: () => void;
  error?: string | null;
  pending?: boolean;
}

export function TextPromptDialog({
  title,
  fields,
  submitLabel,
  cancelLabel,
  onSubmit,
  onDismiss,
  error,
  pending,
}: TextPromptDialogProps) {
  const { mounted, handleClose } = useDialogAnimation(onDismiss);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""]))
  );

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

      {/* "Vidro" (mesmo padrão do dropdown de histórico do SearchBar.tsx) */}
      <form
        className={cn(
          "relative w-full max-w-[380px] rounded-xl border border-white/10 p-5 shadow-lg backdrop-blur-[18px] backdrop-saturate-[180%] transition-all duration-200 ease-out",
          mounted ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        )}
        style={{
          background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(20,22,30,0.85)",
        }}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(values);
        }}
      >
        <h2 className="mb-4 text-base font-semibold text-text">{title}</h2>

        <div className="space-y-3">
          {fields.map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="mb-1 block text-xs text-muted">
                {field.label}
              </label>
              <input
                id={field.name}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                value={values[field.name] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary"
              />
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-xs text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-lg border border-border py-2.5 text-sm text-text"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-background disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
