import { useCallback, useEffect, useState } from "react";
import { fetchUpcomingGroups, type UpcomingGroup } from "./upcomingEpisodes";
import { useTranslation } from "./i18n/LocaleProvider";

export function useUpcomingEpisodes() {
  const { locale } = useTranslation();
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);
    fetchUpcomingGroups(locale)
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((error) => {
        console.error("[useUpcomingEpisodes] Falha ao buscar próximos episódios", error);
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

  return { groups, isLoading, isError, refetch };
}
