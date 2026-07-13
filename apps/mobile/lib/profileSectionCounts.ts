import { supabase } from "@/lib/supabase";

export interface ProfileSectionCounts {
  lists: number;
  series: number;
  favoriteSeries: number;
  movies: number;
  favoriteMovies: number;
}

/**
 * TASK-116 (correção — Perfil) — porta fiel de
 * `profile-section-counts.ts`, incluindo uma correção de bug já
 * documentada lá: contar só `series_status` sub-contava séries que
 * só têm episódio marcado (sem nenhuma linha de status explícita) —
 * a mesma união que `fetchLibraryItems` já faz (ver lib/library.ts).
 */
async function countDistinctSeries(userId: string): Promise<number> {
  const [statusResult, episodesResult] = await Promise.all([
    supabase.from("series_status").select("series_id, status").eq("user_id", userId),
    supabase.from("watched_episodes").select("series_id").eq("user_id", userId).eq("is_special", false),
  ]);

  const ids = new Set<number>();
  for (const row of statusResult.data ?? []) {
    if (row.status !== "removed") ids.add(row.series_id);
  }
  for (const row of episodesResult.data ?? []) {
    ids.add(row.series_id);
  }
  for (const row of statusResult.data ?? []) {
    if (row.status === "removed") ids.delete(row.series_id);
  }
  return ids.size;
}

export async function fetchProfileSectionCounts(userId: string): Promise<ProfileSectionCounts> {
  const [listsResult, seriesCount, favSeriesResult, moviesResult, favMoviesResult] = await Promise.all([
    supabase.from("lists").select("id", { count: "exact", head: true }).eq("user_id", userId),
    countDistinctSeries(userId),
    supabase.from("favorites").select("media_id", { count: "exact", head: true }).eq("user_id", userId).eq("media_type", "series"),
    supabase.from("movie_status").select("movie_id", { count: "exact", head: true }).eq("user_id", userId),
    supabase.from("favorites").select("media_id", { count: "exact", head: true }).eq("user_id", userId).eq("media_type", "movie"),
  ]);

  return {
    lists: listsResult.count ?? 0,
    series: seriesCount,
    favoriteSeries: favSeriesResult.count ?? 0,
    movies: moviesResult.count ?? 0,
    favoriteMovies: favMoviesResult.count ?? 0,
  };
}
