import { useCallback, useEffect, useState } from "react";
import { fetchActivityFeed, type ActivityItem } from "./activityFeed";
import { useTranslation } from "./i18n/LocaleProvider";

/**
 * SEM USO (2026-10-01) — servia só a sub-aba "Atividade" de Explorar,
 * removida junto da entrada de Activity Cards no Feed (ver
 * `app/(tabs)/explore.tsx` e `components/feed/ActivityCard.tsx` — o
 * Feed busca `fetchActivityFeed` direto, via `lib/useFeedEntries.ts`,
 * sem passar por este hook). Deixado aqui (não apagado) pelo mesmo
 * motivo de `components/explore/FeedTabContent.tsx`: nenhum outro
 * lugar usa, mas apagar arquivo é decisão à parte, não tomada sozinho.
 * Só corrigida a chamada de `fetchActivityFeed` (ganhou um parâmetro
 * novo, `scope`) pra não quebrar o build do projeto inteiro.
 */
export function useActivityFeed() {
  const { locale } = useTranslation();
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    fetchActivityFeed("following", locale)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((error) => {
        console.error("[useActivityFeed] Falha ao buscar atividade", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken, locale]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { items, isLoading, isError, refetch };
}
