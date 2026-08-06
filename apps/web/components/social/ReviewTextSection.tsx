"use client";

import { useMemo } from "react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useReviews, useMyReview, useUpsertReview, useDeleteReview } from "@/lib/queries/social/reviews";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { usePublishReviewToFeed } from "@/lib/queries/posts";
import { useToast } from "@/lib/toast/ToastProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ReviewFullComposer } from "./ReviewFullComposer";
import { ReviewCard } from "./ReviewCard";
import { ReviewsSkeleton } from "./ReviewsSkeleton";
import { EmptyState } from "../search/EmptyState";

export interface ReviewTextSectionProps {
  target: MediaTarget;
  media?: { type: "movie" | "series"; title: string; posterPath: string | null };
}

/**
 * A PEDIDO (revertendo uma decisão anterior — "não gostei, deixa
 * prático") — nota e texto voltaram a ser UM formulário só
 * (`ReviewFullComposer`), aqui dentro de "Ver todas as avaliações".
 * Antes: nota (estrelas) ficava sozinha na aba Sobre
 * (`ReviewsSection.tsx`) e o texto só liberava depois, aqui, criando
 * duas paradas pra uma avaliação só. A aba Sobre agora só mostra o
 * resumo da comunidade, sem nada pra preencher.
 */
export function ReviewTextSection({ target, media }: ReviewTextSectionProps) {
  const { data: reviews = [], isLoading } = useReviews(target);
  const { data: myReview } = useMyReview(target);
  const upsertReview = useUpsertReview(target);
  const deleteReview = useDeleteReview(target);
  const publishToFeed = usePublishReviewToFeed();
  const toast = useToast();
  const { t } = useTranslation();

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  /** AUDITORIA (perf) — mesma correção de CommentsSection.tsx: 1 consulta pra todas as reviews visíveis, não uma por review. */
  const reviewIds = useMemo(() => othersReviews.map((r) => r.id), [othersReviews]);
  const { data: likeInfoByReviewId } = useLikeInfoBatch("review", reviewIds);

  function handleSubmit(rating: number, reviewText: string | null, shareToFeed: boolean) {
    upsertReview.mutate(
      { rating, reviewText },
      {
        onSuccess: () => {
          if (!shareToFeed || !media) return;
          publishToFeed.mutate(
            {
              body: reviewText ?? "",
              review: {
                mediaType: media.type,
                mediaId: target.mediaId,
                mediaTitle: media.title,
                mediaPosterPath: media.posterPath,
                rating,
              },
            },
            {
              onSuccess: () => toast.success(t("social.publishedToFeed")),
              onError: () => toast.error(t("social.publishToFeedError")),
            }
          );
        },
      }
    );
  }

  return (
    <div className="space-y-4">
      {/*
        * DECISÃO DE PRODUTO (a pedido — aba Feed descontinuada) — a
        * caixa "Publicar também no Feed" saiu daqui (`canShareToFeed`
        * não é mais passado): oferecer publicar num lugar que ninguém
        * consegue mais abrir seria enganoso. A prop continua
        * existindo no componente compartilhado, então voltar é só
        * passá-la de novo.
        */}
      <ReviewFullComposer
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.reviewText}
        hasExistingReview={Boolean(myReview)}
        isPending={upsertReview.isPending}
        isDeleting={deleteReview.isPending}
        onSubmit={handleSubmit}
        onDelete={() => myReview && deleteReview.mutate(myReview.id)}
      />

      {isLoading ? (
        <ReviewsSkeleton />
      ) : othersReviews.length === 0 ? (
        <EmptyState message={t("social.emptyOtherReviews")} />
      ) : (
        <div className="space-y-3">
          {othersReviews.map((review) => (
            <ReviewCard key={review.id} review={review} likeInfo={likeInfoByReviewId?.get(review.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
