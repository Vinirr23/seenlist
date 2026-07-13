import { useEffect, useState } from "react";
import { fetchActivityFeed, type ActivityItem } from "./activityFeed";

export function useActivityFeed() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchActivityFeed()
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
  }, []);

  return { items, isLoading, isError };
}
