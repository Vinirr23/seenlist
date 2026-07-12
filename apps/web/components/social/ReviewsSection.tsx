"use client";

import type { MediaTarget } from "@/lib/queries/social/types";
import { useReviews, useMyReview, useUpsertReview, useDeleteReview } from "@/lib/queries/social/reviews";
import { useCreatePost } from "@/lib/queries/posts";
import { useToast } from "@/lib/toast/ToastProvider";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewCard } from "./ReviewCard";
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

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

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
              onSuccess: () => toast.success("Publicado no Feed"),
              onError: () => toast.error("Avaliação salva, mas não foi possível publicar no Feed agora."),
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
