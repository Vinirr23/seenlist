import { useQuery } from "@tanstack/react-query";
import type { MovieWatchStatus } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";

export function movieStatusQueryKey(movieId: number) {
  return ["movie-status", movieId] as const;
}

/** CORREÇÃO — mesma causa do bug em series-status: RLS agora também permite ver movie_status de outros usuários com perfil público, então precisa filtro explícito por user_id. */
async function fetchMovieStatus(movieId: number): Promise<MovieWatchStatus | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("movie_status")
    .select("status")
    .eq("movie_id", movieId)
    .eq("user_id", user.id)
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
