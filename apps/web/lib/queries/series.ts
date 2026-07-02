import { useQuery } from "@tanstack/react-query";
import type { SeriesDetails } from "@seenlist/types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchSeriesDetails(seriesId: string): Promise<SeriesDetails> {
  const response = await fetch(`/api/tmdb/series/${seriesId}`);
  if (!response.ok) {
    throw new Error("series details fetch failed");
  }
  return response.json() as Promise<SeriesDetails>;
}

export function useSeriesDetails(seriesId: string) {
  return useQuery({
    queryKey: ["series", seriesId],
    queryFn: () => fetchSeriesDetails(seriesId),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
