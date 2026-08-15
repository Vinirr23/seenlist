import { useQuery } from "@tanstack/react-query";
import type { MovieDetails } from "@seenlist/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchMovieDetails(movieId: string, language: string): Promise<MovieDetails> {
  const response = await fetch(`/api/tmdb/movie/${movieId}?language=${language}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "movie details fetch failed");
  }
  return response.json() as Promise<MovieDetails>;
}

/** A PEDIDO — mesma correção de `series.ts`, aplicada ao filme. */
export function useMovieDetails(movieId: string) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["movie", movieId, locale],
    queryFn: () => fetchMovieDetails(movieId, locale),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
