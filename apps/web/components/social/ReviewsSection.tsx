"use client";

import { useMemo } from "react";
import type { MediaTarget } from "@/lib/queries/social/types";
import { useReviews, useMyReview, useUpsertReview, useDeleteReview } from "@/lib/queries/social/reviews";
import { useLikeInfoBatch } from "@/lib/queries/social/likes";
import { useCreatePost } from "@/lib/queries/posts";
import { useToast } from "@/lib/toast/ToastProvider";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewCard } from "./ReviewCard";
import { ReviewsSkeleton } from "./ReviewsSkeleton";
import { EmptyState } from "../search/EmptyState";

export interface ReviewsSectionProps {
  target: MediaTarget;
  /** TASK-078 — só passado por quem já tem esse dado à mão (SeriesDetailsView/MovieDetailsView) — sem isso, "Publicar no Feed" não aparece (não dá pra montar o cartão do post sem título/capa). */
  media?: { type: "movie" | "series"; title: string; posterPath: string | null };
}

export function ReviewsSection({ target, media }: ReviewsSectionProps) {
  const { data: reviews = [], isLoading } = useReviews(target);
  const { data: myReview } = useMyReview(target);
  const upsertReview = useUpsertReview(target);
  const deleteReview = useDeleteReview(target);
  const createPost = useCreatePost();
  const toast = useToast();
  const { t } = useTranslation();

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  /** AUDITORIA (perf) — mesma correção de CommentsSection.tsx: 1 consulta pra todas as reviews visíveis, não uma por review. */
  const reviewIds = useMemo(() => othersReviews.map((r) => r.id), [othersReviews]);
  const { data: likeInfoByReviewId } = useLikeInfoBatch("review", reviewIds);

  function handleSubmit(rating: number, reviewText: string | null, containsSpoiler: boolean, shareToFeed: boolean) {
    upsertReview.mutate(
      { rating, reviewText, containsSpoiler },
      {
        onSuccess: () => {
          if (!shareToFeed || !media) return;
          createPost.mutate(
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
      <ReviewComposer
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.reviewText ?? ""}
        initialSpoiler={myReview?.containsSpoiler ?? false}
        isPending={upsertReview.isPending}
        canShareToFeed={Boolean(media)}
        onSubmit={handleSubmit}
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
