"use client";

import { useEffect, useState } from "react";

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
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.name, field.defaultValue ?? ""]))
  );

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

      <form
        className="relative w-full max-w-[380px] rounded-xl border border-border bg-surface p-5"
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
            onClick={onDismiss}
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
