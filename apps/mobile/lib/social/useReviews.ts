import { useCallback, useEffect, useState } from "react";
import { deleteReview, fetchMyReview, fetchReviews, upsertReview, type Review, type ReviewTarget } from "./reviews";

export function useReviews(target: ReviewTarget) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [all, mine] = await Promise.all([fetchReviews(target), fetchMyReview(target)]);
      setReviews(all);
      setMyReview(mine);
    } catch (error) {
      console.error("[useReviews] Falha ao buscar avaliações", error);
    } finally {
      setIsLoading(false);
    }
  }, [target.mediaType, target.mediaId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = useCallback(
    async (rating: number, reviewText: string | null, containsSpoiler: boolean) => {
      setSaving(true);
      try {
        await upsertReview(target, { rating, reviewText, containsSpoiler });
        await load();
        return true;
      } catch (error) {
        console.error("[useReviews] Falha ao salvar avaliação", error);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [target.mediaType, target.mediaId, load]
  );

  const remove = useCallback(async () => {
    if (!myReview) return;
    setSaving(true);
    try {
      await deleteReview(myReview.id);
      await load();
    } catch (error) {
      console.error("[useReviews] Falha ao remover avaliação", error);
    } finally {
      setSaving(false);
    }
  }, [myReview, load]);

  const othersReviews = reviews.filter((r) => r.id !== myReview?.id);

  return { othersReviews, myReview, isLoading, saving, submit, remove };
}
