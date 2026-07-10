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
 * TASK-062 (correção real, comprovada) — achado: contador de
 * "Séries" no Perfil mostrando 0 mesmo com séries em "Assistindo"
 * na tela de Séries. Causa: antes contava só linhas de
 * `series_status`, mas uma série pode estar na Biblioteca sem
 * NENHUMA linha lá — se o usuário só marca episódios (nunca abre um
 * seletor de status explícito), o status "Assistindo" que aparece é
 * só um fallback calculado na hora (ver `buildLibraryItemsFromRows`
 * em `library-state.ts`, `isDerived: !explicit`). Precisa contar a
 * MESMA união que a Biblioteca usa: `series_status` (exceto
 * "removed") + qualquer `series_id` com episódio assistido — não só
 * a primeira tabela. Ainda leve: só a coluna de id em cada consulta,
 * união feita em memória (o `count: "exact", head: true` não dá pra
 * usar mais aqui, porque a união de duas tabelas não é uma contagem
 * que o Supabase resolve num `SELECT` só).
 */
async function countDistinctSeries(supabase: ReturnType<typeof createClient>, userId: string): Promise<number> {
  const [statusResult, episodesResult] = await Promise.all([
    supabase.from("series_status").select("series_id, status").eq("user_id", userId),
    supabase.from("watched_episodes").select("series_id").eq("user_id", userId).eq("is_special", false),
  ]);

  if (statusResult.error) {
    console.error(`[profile-section-counts] Falha ao contar "series" (series_status)`, describeSupabaseError(statusResult.error));
  }
  if (episodesResult.error) {
    console.error(`[profile-section-counts] Falha ao contar "series" (watched_episodes)`, describeSupabaseError(episodesResult.error));
  }

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
      const [listsResult, seriesCount, favSeriesResult, moviesResult, favMoviesResult] = await Promise.all([
        supabase.from("lists").select("id", { count: "exact", head: true }).eq("user_id", userId),
        countDistinctSeries(supabase, userId),
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
        series: seriesCount,
        favoriteSeries: favSeriesResult.count ?? 0,
        movies: moviesResult.count ?? 0,
        favoriteMovies: favMoviesResult.count ?? 0,
      };
    },
    enabled: Boolean(userId),
  });
}