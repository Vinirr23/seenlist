import { useQuery } from "@tanstack/react-query";
import type { DiscoverItem } from "@/lib/tmdb/client";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export type DiscoverListKey =
  | "trending_series"
  | "trending_movies"
  | "popular_series"
  | "popular_movies"
  | "upcoming_movies"
  | "on_the_air_series";

interface DiscoverListResponse {
  items: DiscoverItem[];
  genreMap: Record<number, string> | null;
}

async function fetchDiscoverList(list: DiscoverListKey, withGenres: boolean): Promise<DiscoverListResponse> {
  const response = await fetch(`/api/tmdb/explore?list=${list}${withGenres ? "&genres=1" : ""}`);
  if (!response.ok) throw new Error("discover fetch failed");
  return response.json();
}

/**
 * TASK-058 — uma lista de descoberta (trending, popular, etc). Cache
 * de 5 min, mesmo padrão de staleTime já usado por upcoming-episodes
 * e outras consultas TMDB do projeto.
 */
export function useDiscoverList(list: DiscoverListKey, withGenres = false) {
  return useQuery({
    queryKey: ["discover-list", list, withGenres],
    queryFn: () => fetchDiscoverList(list, withGenres),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}

export function genreNames(item: DiscoverItem, genreMap: Record<number, string> | null | undefined): string[] {
  if (!genreMap) return [];
  return item.genreIds.map((id) => genreMap[id]).filter((name): name is string => Boolean(name));
}
