import { useEffect, useState } from "react";
import { fetchDiscoverList, type DiscoverItem, type DiscoverListKey } from "./discover";
import { useTranslation } from "./i18n/LocaleProvider";

export function useDiscoverList(list: DiscoverListKey) {
  const { locale } = useTranslation();
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchDiscoverList(list, locale)
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
  }, [list, locale]);

  return { items, isLoading, isError };
}
