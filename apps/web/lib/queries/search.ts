import { useQuery } from "@tanstack/react-query";
import type { MediaSearchResult } from "@seenlist/types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchSearchResults(query: string): Promise<MediaSearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
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
 */
export function useSearchMedia(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => fetchSearchResults(query),
    enabled: query.trim().length > 0,
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
