import { useEffect, useState } from "react";
import { fetchUpcomingGroups, type UpcomingGroup } from "./upcomingEpisodes";

export function useUpcomingEpisodes() {
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchUpcomingGroups()
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
  }, []);

  return { groups, isLoading, isError };
}
