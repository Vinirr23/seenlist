"use client";

import { useMemo } from "react";
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

  return (
    <div className="space-y-4">
      {myReview && myReview.rating != null && myReview.rating > 0 && (
        <ReviewTextComposer
          myRating={myReview.rating}
          initialText={myReview.reviewText}
          initialSpoiler={myReview.containsSpoiler}
          isPending={upsertReview.isPending}
          canShareToFeed={Boolean(media)}
          onSubmit={handleSubmit}
        />
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
