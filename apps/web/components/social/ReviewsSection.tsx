"use client";

import type { MediaTarget } from "@/lib/queries/social/types";
import { useReviews, useMyReview, useUpsertReview, useDeleteReview } from "@/lib/queries/social/reviews";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewCard } from "./ReviewCard";
import { EmptyState } from "../search/EmptyState";

export function ReviewsSection({ target }: { target: MediaTarget }) {
  const { data: reviews = [], isLoading } = useReviews(target);
  const { data: myReview } = useMyReview(target);
  const upsertReview = useUpsertReview(target);
  const deleteReview = useDeleteReview(target);

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  return (
    <div className="space-y-4">
      <ReviewComposer
        initialRating={myReview?.rating ?? 0}
        initialText={myReview?.reviewText ?? ""}
        initialSpoiler={myReview?.containsSpoiler ?? false}
        isPending={upsertReview.isPending}
        onSubmit={(rating, reviewText, containsSpoiler) => upsertReview.mutate({ rating, reviewText, containsSpoiler })}
      />
      {myReview && (
        <button
          type="button"
          onClick={() => deleteReview.mutate(myReview.id)}
          disabled={deleteReview.isPending}
          className="text-xs font-medium text-danger disabled:opacity-50"
        >
          Remover minha avaliação
        </button>
      )}

      {isLoading ? (
        <p className="text-center text-xs text-muted">Carregando avaliações...</p>
      ) : othersReviews.length === 0 ? (
        <EmptyState message="Nenhuma outra avaliação ainda." />
      ) : (
        <div className="space-y-3">
          {othersReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
