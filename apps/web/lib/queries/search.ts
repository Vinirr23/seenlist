import { useQuery } from "@tanstack/react-query";
import type { MediaSearchResult } from "@seenlist/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchSearchResults(query: string, language: string): Promise<MediaSearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&language=${language}`);
  if (!response.ok) {
    throw new Error("search failed");
  }
  const data = (await response.json()) as { results: MediaSearchResult[] };
  return data.results;
}

/**
 * `query` já deve chegar aqui com debounce aplicado (ver
 * `useDebouncedValue` em @seenlist/hooks) — este hook não faz
 * debounce, só cache/estado da busca em si.
 *
 * A PEDIDO — resultado de busca (título) sempre vinha em português,
 * mesmo com o app noutro idioma. `locale` entra na `queryKey` de
 * propósito: sem isso, trocar de idioma não invalidava o cache, e a
 * pessoa continuava vendo o resultado antigo até fechar/reabrir.
 */
export function useSearchMedia(query: string) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["search", query, locale],
    queryFn: () => fetchSearchResults(query, locale),
    enabled: query.trim().length > 0,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
