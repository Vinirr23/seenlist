"use client";

import { useState } from "react";
import { StarRating } from "./StarRating";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewComposerProps {
  initialRating?: number;
  onSubmit: (rating: number) => void;
  isPending?: boolean;
}

/**
 * A PEDIDO (correção real, confirmada pelo usuário — "ter review e
 * comentários é redundante") — só a NOTA fica na aba Sobre; o texto
 * da review (opcional) e o "contém spoiler"/"publicar no Feed" agora
 * moram dentro de Comentários (`ReviewTextComposer.tsx`), junto com
 * as reviews de outras pessoas — não faz mais sentido ter duas
 * telas separadas mostrando review com texto.
 *
 * Continua sendo o MESMO registro na tabela `reviews` — só mudou
 * ONDE cada parte é editada. `useUpsertReview` já suportava
 * atualização parcial (só rating, sem tocar no texto) antes disso.
 */
export function ReviewComposer({ initialRating = 0, onSubmit, isPending }: ReviewComposerProps) {
  const [rating, setRating] = useState(initialRating);
  const { t } = useTranslation();

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <StarRating value={rating} onChange={setRating} />
      <button
        type="button"
        disabled={rating === 0 || rating === initialRating || isPending}
        onClick={() => onSubmit(rating)}
        className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
      >
        {t("social.saveReview")}
      </button>
    </div>
  );
}
