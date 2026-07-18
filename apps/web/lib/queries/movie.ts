import { useQuery } from "@tanstack/react-query";
import type { MovieDetails } from "@seenlist/types";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchMovieDetails(movieId: string): Promise<MovieDetails> {
  const response = await fetch(`/api/tmdb/movie/${movieId}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "movie details fetch failed");
  }
  return response.json() as Promise<MovieDetails>;
}

export function useMovieDetails(movieId: string) {
  return useQuery({
    queryKey: ["movie", movieId],
    queryFn: () => fetchMovieDetails(movieId),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
