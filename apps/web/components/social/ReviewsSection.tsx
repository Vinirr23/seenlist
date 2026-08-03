"use client";

import { useReviewAggregate, useMyReview, useUpsertReview, useDeleteReview } from "@/lib/queries/social/reviews";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewSummary } from "./ReviewSummary";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ReviewsSectionProps {
  target: import("@/lib/queries/social/types").MediaTarget;
}

/**
 * A PEDIDO (correção real, confirmada — "review e comentários
 * redundante") — essa seção (aba Sobre) agora só mostra o RESUMO da
 * comunidade + a nota da pessoa (estrelas). Texto da review,
 * "contém spoiler", "publicar no Feed" e a lista de reviews de
 * outras pessoas se mudaram pra dentro de Comentários
 * (`ReviewTextComposer.tsx` + `CommentsPageView.tsx`) — não faz mais
 * sentido ter duas telas mostrando review com texto.
 */
export function ReviewsSection({ target }: ReviewsSectionProps) {
  const { data: aggregate } = useReviewAggregate(target);
  const { data: myReview } = useMyReview(target);
  const upsertReview = useUpsertReview(target);
  const deleteReview = useDeleteReview(target);
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {aggregate && <ReviewSummary aggregate={aggregate} />}
      <ReviewComposer
        initialRating={myReview?.rating ?? 0}
        isPending={upsertReview.isPending}
        onSubmit={(rating) => upsertReview.mutate({ rating })}
      />
      {myReview && (
        <button
          type="button"
          onClick={() => deleteReview.mutate(myReview.id)}
          disabled={deleteReview.isPending}
          className="text-xs font-medium text-danger disabled:opacity-50"
        >
          {t("social.removeMyReview")}
        </button>
      )}
    </div>
  );
}
