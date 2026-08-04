import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { fetchReviewAggregate, type ReviewAggregate, type ReviewTarget } from "./reviews";

/** A PEDIDO (implementar tudo igual ao web) — porta de `useReviewAggregate` do web. */
export function useReviewAggregate(target: ReviewTarget) {
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null);

  const load = useCallback(() => {
    fetchReviewAggregate(target)
      .then(setAggregate)
      .catch((error) => console.error("[useReviewAggregate] Falha ao buscar resumo de avaliações", error));
  }, [target.mediaType, target.mediaId]);

  useEffect(load, [load]);
  useFocusEffect(load);

  return aggregate;
}
