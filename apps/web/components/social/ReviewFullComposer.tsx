"use client";

import { useState } from "react";
import { StarRating } from "./StarRating";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewFullComposerProps {
  initialRating?: number;
  initialText?: string | null;
  hasExistingReview: boolean;
  onSubmit: (rating: number, reviewText: string | null, shareToFeed: boolean) => void;
  onDelete?: () => void;
  isPending?: boolean;
  isDeleting?: boolean;
  /** Só mostra "Publicar também no Feed" quando a tela sabe pra qual título isso é. */
  canShareToFeed?: boolean;
}

/**
 * A PEDIDO (revertendo uma decisão anterior — "não gostei, deixa
 * prático") — nota (estrelas) e texto da review voltaram a ser UM
 * formulário só, num lugar só ("Ver todas as avaliações"). Antes
 * (`ReviewComposer.tsx` + `ReviewTextComposer.tsx`) estavam separados
 * em duas telas — dar nota na aba Sobre, escrever o texto só depois,
 * em Comentários.
 *
 * A PEDIDO — "Contém spoiler" saiu (review de mídia inteira raramente
 * precisa disso; quem quiser avisar spoiler pode escrever no próprio
 * texto). "Publicar também no Feed" vem MARCADO por padrão — quem não
 * quiser publicar desmarca, em vez de precisar lembrar de marcar.
 *
 * A aba Sobre continua só com o resumo da comunidade
 * (`ReviewSummary.tsx`, sem interação) — ver `ReviewsSection.tsx`.
 */
export function ReviewFullComposer({
  initialRating = 0,
  initialText,
  hasExistingReview,
  onSubmit,
  onDelete,
  isPending,
  isDeleting,
  canShareToFeed = false,
}: ReviewFullComposerProps) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText ?? "");
  const [shareToFeed, setShareToFeed] = useState(true);
  const { t } = useTranslation();

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <StarRating value={rating} onChange={setRating} />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("social.reviewPlaceholder")}
        rows={3}
        maxLength={4000}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

      {canShareToFeed && (
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input
            type="checkbox"
            checked={shareToFeed}
            onChange={(e) => setShareToFeed(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-primary"
          />
          {t("social.shareToFeed")}
        </label>
      )}

      <div className="flex items-center justify-between border-t border-border pt-2.5">
        {hasExistingReview && onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs font-medium text-danger disabled:opacity-50"
          >
            {t("social.removeMyReview")}
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={rating === 0 || isPending}
          onClick={() => onSubmit(rating, text.trim() || null, shareToFeed)}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          {t("social.saveReview")}
        </button>
      </div>
    </div>
  );
}
