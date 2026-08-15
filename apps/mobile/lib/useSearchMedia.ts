import { useEffect, useState } from "react";
import type { MediaSearchResult } from "@seenlist/types";
import { fetchSearchResults } from "./search";
import { useTranslation } from "./i18n/LocaleProvider";

export function useSearchMedia(query: string) {
  const { locale } = useTranslation();
  const [data, setData] = useState<MediaSearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setData(null);
      setIsLoading(false);
      setIsError(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setIsError(false);

    fetchSearchResults(trimmed, locale)
      .then((results) => {
        if (!cancelled) setData(results);
      })
      .catch((error) => {
        console.error("[useSearchMedia] Falha na busca", error);
        if (!cancelled) setIsError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, locale]);

  return { data, isLoading, isError };
}
