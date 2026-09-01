"use client";

import { useState } from "react";
import { StarRating } from "./StarRating";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewFullComposerProps {
  initialRating?: number;
  initialText?: string | null;
  hasExistingReview: boolean;
  onSubmit: (rating: number, reviewText: string | null) => void;
  onDelete?: () => void;
  isPending?: boolean;
  isDeleting?: boolean;
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
 * texto).
 *
 * BUG REAL CORRIGIDO (2026-08-27, ver comentário completo em
 * `ReviewTextSection.tsx`) — existia aqui uma caixa "Publicar também
 * no Feed", escondida (nunca recebia `canShareToFeed={true}`) desde
 * que o Feed foi descontinuado. Só a caixa tinha sido escondida: o
 * estado dela (`shareToFeed`) continuava começando `true` em toda
 * avaliação nova, sem jeito nenhum de desmarcar, e isso disparava um
 * envio pro Feed que sempre falhava. Removida por completo agora —
 * caixa, estado, e o parâmetro `shareToFeed` que saía daqui pro
 * `onSubmit` — não só escondida de novo.
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
}: ReviewFullComposerProps) {
  const [rating, setRating] = useState(initialRating);
  const [text, setText] = useState(initialText ?? "");
  const { t } = useTranslation();

  return (
    // "Vidro" (redesign âmbar/vidro, 2026-08-26 — Comentários/Avaliações) — mesma textura de card neutro do resto do app; textarea/checkbox internos ficam como estão (campos de formulário não recebem vidro, mesmo critério já usado em toda a Série/Filme/Episódio/Configurações).
    <div
      className="space-y-3 rounded-2xl border border-white/10 p-3.5 backdrop-blur-[18px] backdrop-saturate-[180%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.17), transparent 60%), rgba(255,255,255,0.10)",
      }}
    >
      <StarRating value={rating} onChange={setRating} />

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("social.reviewPlaceholder")}
        rows={3}
        maxLength={4000}
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none"
      />

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
          onClick={() => onSubmit(rating, text.trim() || null)}
          className="rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          {t("social.saveReview")}
        </button>
      </div>
    </div>
  );
}
