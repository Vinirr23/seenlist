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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- proposital: depende só dos campos primitivos de `target`, não do objeto inteiro, pra não reexecutar toda vez que o chamador recriar `target` sem memoizar (mesmo padrão de `useReviews.ts`).
  }, [target.mediaType, target.mediaId]);

  useEffect(load, [load]);
  useFocusEffect(load);

  return aggregate;
}
