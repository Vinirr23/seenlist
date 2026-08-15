import { useCallback, useEffect, useState } from "react";
import { fetchActivityFeed, type ActivityItem } from "./activityFeed";
import { useTranslation } from "./i18n/LocaleProvider";

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
    fetchActivityFeed(locale)
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
