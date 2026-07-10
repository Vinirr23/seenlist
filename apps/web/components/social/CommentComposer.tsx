"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { hapticTick } from "@/lib/haptics";

export interface CommentComposerProps {
  initialBody?: string;
  initialSpoiler?: boolean;
  placeholder?: string;
  submitLabel?: string;
  onSubmit: (body: string, containsSpoiler: boolean) => void;
  onCancel?: () => void;
  isPending?: boolean;
}

/**
 * TASK-048 — mesmo componente pra "novo comentário", "responder" e
 * "editar" — só muda o texto inicial e o rótulo do botão, quem chama
 * decide (CommentThread passa `initialBody` quando é edição).
 */
export function CommentComposer({
  initialBody = "",
  initialSpoiler = false,
  placeholder = "Escreva um comentário...",
  submitLabel = "Publicar",
  onSubmit,
  onCancel,
  isPending,
}: CommentComposerProps) {
  const [body, setBody] = useState(initialBody);
  const [containsSpoiler, setContainsSpoiler] = useState(initialSpoiler);

  function handleSubmit() {
    const trimmed = body.trim();
    if (!trimmed) return;
    hapticTick();
    onSubmit(trimmed, containsSpoiler);
    if (!initialBody) {
      setBody("");
      setContainsSpoiler(false);
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={2}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={containsSpoiler}
            onChange={(e) => setContainsSpoiler(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          Contém spoiler
        </label>
        <div className="flex gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="text-xs font-medium text-muted">
              Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={!body.trim() || isPending}
            onClick={handleSubmit}
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
