import { useQuery } from "@tanstack/react-query";
import type { MovieWatchStatus } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";

export function movieStatusQueryKey(movieId: number) {
  return ["movie-status", movieId] as const;
}

/** RLS já restringe à linha do usuário logado. */
async function fetchMovieStatus(movieId: number): Promise<MovieWatchStatus | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("movie_status")
    .select("status")
    .eq("movie_id", movieId)
    .maybeSingle();

  if (error) throw error;
  return (data?.status as MovieWatchStatus | undefined) ?? null;
}

export function useMovieStatus(movieId: number) {
  return useQuery({
    queryKey: movieStatusQueryKey(movieId),
    queryFn: () => fetchMovieStatus(movieId),
  });
}
