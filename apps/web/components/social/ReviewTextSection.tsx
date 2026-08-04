"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useReviews, useMyReview, useUpsertReview } from "@/lib/queries/social/reviews";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useCreatePost } from "@/lib/queries/posts";
import { useToast } from "@/lib/toast/ToastProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ReviewTextComposer } from "./ReviewTextComposer";
import { ReviewCard } from "./ReviewCard";
import { ReviewsSkeleton } from "./ReviewsSkeleton";
import { EmptyState } from "../search/EmptyState";

export interface ReviewTextSectionProps {
  target: MediaTarget;
  media?: { type: "movie" | "series"; title: string; posterPath: string | null };
}

/**
 * A PEDIDO (correção real, confirmada — "review e comentários
 * redundante") — texto da review (opcional, só pra quem já deu
 * nota), "contém spoiler", "publicar no Feed", e a lista de reviews
 * de outras pessoas — tudo que antes morava na aba Sobre, agora vive
 * dentro da tela de Comentários (`CommentsSection.tsx`, antes do
 * comentário normal). A NOTA em si (estrelas) continua na aba Sobre
 * (`ReviewsSection.tsx`).
 */
export function ReviewTextSection({ target, media }: ReviewTextSectionProps) {
  const { data: reviews = [], isLoading } = useReviews(target);
  const { data: myReview } = useMyReview(target);
  const upsertReview = useUpsertReview(target);
  const createPost = useCreatePost();
  const toast = useToast();
  const { t } = useTranslation();

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  /** AUDITORIA (perf) — mesma correção de CommentsSection.tsx: 1 consulta pra todas as reviews visíveis, não uma por review. */
  const reviewIds = useMemo(() => othersReviews.map((r) => r.id), [othersReviews]);
  const { data: likeInfoByReviewId } = useLikeInfoBatch("review", reviewIds);

  function handleSubmit(reviewText: string | null, containsSpoiler: boolean, shareToFeed: boolean) {
    upsertReview.mutate(
      { reviewText, containsSpoiler },
      {
        onSuccess: () => {
          if (!shareToFeed || !media || !myReview) return;
          createPost.mutate(
            {
              body: reviewText ?? "",
              review: {
                mediaType: media.type,
                mediaId: target.mediaId,
                mediaTitle: media.title,
                mediaPosterPath: media.posterPath,
                rating: myReview.rating ?? 0,
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

  const hasRating = Boolean(myReview && myReview.rating != null && myReview.rating > 0);

  /**
   * A PEDIDO (correção real, reportada — "não existe mais opção de
   * escrever review, só mostra") — desde que o comentário comum saiu
   * dessa tela (`CommentsSection.tsx`), quem ainda não deu nota em
   * estrelas na aba Sobre (`ReviewsSection.tsx`) chegava aqui numa
   * tela em branco — o composer de texto só aparece pra quem já tem
   * `myReview.rating > 0` (regra que já existia antes, só que antes
   * o comentário comum embaixo evitava a tela ficar vazia). Link
   * volta pra página do próprio título — pra série, já pede a aba
   * Sobre via `?tab=sobre`.
   */
  const rateFirstHref =
    media?.type === "series" ? `/series/${target.mediaId}?tab=sobre` : `/movies/${target.mediaId}`;

  return (
    <div className="space-y-4">
      {hasRating ? (
        <ReviewTextComposer
          myRating={myReview!.rating!}
          initialText={myReview!.reviewText}
          initialSpoiler={myReview!.containsSpoiler}
          isPending={upsertReview.isPending}
          canShareToFeed={Boolean(media)}
          onSubmit={handleSubmit}
        />
      ) : (
        media && (
          <div className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-sm text-muted">{t("reviews.rateFirstPrompt")}</p>
            <Link href={rateFirstHref} className="mt-2 inline-block text-sm font-semibold text-primary">
              {t("reviews.rateFirstLink")}
            </Link>
          </div>
        )
      )}

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
