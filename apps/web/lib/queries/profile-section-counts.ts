import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";

export interface ProfileSectionCounts {
  lists: number;
  series: number;
  favoriteSeries: number;
  movies: number;
  favoriteMovies: number;
}

/**
 * TASK-029 — "não carregar todas essas listas ao abrir o Perfil,
 * carregar apenas os contadores". Cada consulta usa
 * `{ count: "exact", head: true }` — o Supabase nem devolve as
 * linhas, só o número; é o mesmo padrão já usado em
 * snapshotStore.ts (determineImportType). As 5 rodam em paralelo.
 */
export function useProfileSectionCounts(userId: string | null) {
  return useQuery({
    queryKey: ["profile-section-counts", userId ?? ""],
    queryFn: async (): Promise<ProfileSectionCounts> => {
      if (!userId) {
        return { lists: 0, series: 0, favoriteSeries: 0, movies: 0, favoriteMovies: 0 };
      }

      const supabase = createClient();
      const [listsResult, seriesResult, favSeriesResult, moviesResult, favMoviesResult] = await Promise.all([
        supabase.from("lists").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("series_status").select("series_id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("favorites")
          .select("media_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("media_type", "series"),
        supabase.from("movie_status").select("movie_id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("favorites")
          .select("media_id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("media_type", "movie"),
      ]);

      for (const [label, result] of [
        ["lists", listsResult],
        ["series", seriesResult],
        ["favoriteSeries", favSeriesResult],
        ["movies", moviesResult],
        ["favoriteMovies", favMoviesResult],
      ] as const) {
        if (result.error) {
          console.error(`[profile-section-counts] Falha ao contar "${label}"`, describeSupabaseError(result.error));
        }
      }

      return {
        lists: listsResult.count ?? 0,
        series: seriesResult.count ?? 0,
        favoriteSeries: favSeriesResult.count ?? 0,
        movies: moviesResult.count ?? 0,
        favoriteMovies: favMoviesResult.count ?? 0,
      };
    },
    enabled: Boolean(userId),
  });
}
