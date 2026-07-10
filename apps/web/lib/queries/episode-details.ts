import { useQuery } from "@tanstack/react-query";
import type { EpisodeDetails } from "@/lib/tmdb/client";
import type { WatchProvider } from "@seenlist/types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface EpisodePageData {
  episode: EpisodeDetails;
  watchProviders: WatchProvider[];
}

async function fetchEpisodePage(seriesId: string, season: number, episode: number): Promise<EpisodePageData> {
  const response = await fetch(`/api/tmdb/episode/${seriesId}/${season}/${episode}`);
  if (!response.ok) throw new Error("episode fetch failed");
  return response.json() as Promise<EpisodePageData>;
}

/** TASK-030 — mesmo cache de 5 minutos que useSeriesDetails já usa, pelo mesmo motivo: TMDB muda pouco, não precisa rebuscar toda vez que o usuário volta pra essa tela. */
export function useEpisodeDetails(seriesId: string, season: number, episode: number) {
  return useQuery({
    queryKey: ["episode", seriesId, season, episode],
    queryFn: () => fetchEpisodePage(seriesId, season, episode),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
