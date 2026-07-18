import type { MovieDetails, MovieWatchStatus } from "@seenlist/types";
import { supabase, getCurrentAuthUser } from "@/lib/supabase";

const SITE_URL = "https://seenlist.app";

/** Idêntico a lib/queries/movie.ts do web. */
export async function fetchMovieDetails(movieId: string): Promise<MovieDetails> {
  const response = await fetch(`${SITE_URL}/api/tmdb/movie/${movieId}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? "movie details fetch failed");
  }
  return response.json() as Promise<MovieDetails>;
}

/** Idêntico a movie-status-state.ts do web. */
export async function fetchMovieStatus(movieId: number): Promise<MovieWatchStatus | null> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) return null;

  const { data, error } = await supabase.from("movie_status").select("status").eq("movie_id", movieId).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return (data?.status as MovieWatchStatus | undefined) ?? null;
}

/** Idêntico a useSetMovieStatus do web: tocar no status já ativo remove; tocar em outro substitui. */
export async function setMovieStatus(movieId: number, status: MovieWatchStatus, currentStatus: MovieWatchStatus | null): Promise<void> {
  const {
    data: { user },
  } = await getCurrentAuthUser();
  if (!user) throw new Error("not authenticated");

  if (currentStatus === status) {
    const { error } = await supabase.from("movie_status").delete().match({ movie_id: movieId, user_id: user.id });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("movie_status")
      .upsert({ user_id: user.id, movie_id: movieId, status, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
}
