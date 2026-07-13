import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { deleteReview, fetchMyReview, fetchReviews, upsertReview, type Review, type ReviewTarget } from "./reviews";

export function useReviews(target: ReviewTarget) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasLoadedOnce = useRef(false);

  const load = useCallback(async () => {
    if (!hasLoadedOnce.current) setIsLoading(true);
    try {
      const [all, mine] = await Promise.all([fetchReviews(target), fetchMyReview(target)]);
      setReviews(all);
      setMyReview(mine);
      hasLoadedOnce.current = true;
    } catch (error) {
      console.error("[useReviews] Falha ao buscar avaliações", error);
    } finally {
      setIsLoading(false);
    }
  }, [target.mediaType, target.mediaId]);

  useEffect(() => {
    load();
  }, [load]);

  /** TASK-125 (correção) — recarrega sozinho ao voltar pra esta tela, mesmo motivo de useLibraryItems.ts. */
  useFocusEffect(
    useCallback(() => {
      if (hasLoadedOnce.current) load();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target.mediaType, target.mediaId])
  );

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
