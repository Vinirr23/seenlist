"use client";

import { useState } from "react";
import { StarRating } from "./StarRating";

export interface ReviewComposerProps {
  initialRating?: number;
  initialText?: string | null;
  initialSpoiler?: boolean;
  onSubmit: (rating: number, reviewText: string | null, containsSpoiler: boolean) => void;
  isPending?: boolean;
}

/** TASK-048 — avaliação rápida (só nota) e review completa (nota + texto) são o mesmo formulário; texto é opcional. */
export function ReviewComposer({
  initialRating = 0,
  initialText = "",
  initialSpoiler = false,
  onSubmit,
  isPending,
}: ReviewComposerProps) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText ?? "");
  const [containsSpoiler, setContainsSpoiler] = useState(initialSpoiler);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-center">
        <StarRating value={rating} onChange={setRating} />
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Escreva uma review (opcional)..."
        rows={3}
        maxLength={4000}
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
        <button
          type="button"
          disabled={rating === 0 || isPending}
          onClick={() => onSubmit(rating, text.trim() || null, containsSpoiler)}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          Salvar avaliação
        </button>
      </div>
    </div>
  );
}
