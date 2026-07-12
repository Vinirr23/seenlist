import { useEffect, useState } from "react";
import { fetchDiscoverList, type DiscoverItem, type DiscoverListKey } from "./discover";

export function useDiscoverList(list: DiscoverListKey) {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchDiscoverList(list)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((error) => {
        console.error(`[useDiscoverList] Falha ao buscar lista "${list}"`, error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [list]);

  return { items, isLoading, isError };
}
