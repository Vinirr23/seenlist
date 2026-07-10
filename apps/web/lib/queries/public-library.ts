import { useQuery } from "@tanstack/react-query";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { buildLibraryItemsFromRows, fetchDisplaySummaries } from "./library-state";

interface MovieStatusRow {
  movie_id: number;
  status: "watched" | "want_to_watch" | "watching";
  created_at: string;
  updated_at: string;
}
interface SeriesStatusRow {
  series_id: number;
  status: LibraryStatus | "removed";
  created_at: string;
  updated_at: string;
  total_watch_events: number | null;
}
interface WatchedEpisodeRow {
  series_id: number;
  watched_at: string;
}

/**
 * TASK-028, item 6/11 — biblioteca pública de outro usuário. Mesma
 * lógica de derivação de `useLibraryItems` (reaproveitada via
 * `buildLibraryItemsFromRows`, não duplicada), só que filtrando
 * explicitamente por `user_id` em vez de confiar no RLS pra "usuário
 * atual" — aqui o usuário atual É o visitante, não o dono da
 * biblioteca sendo exibida.
 *
 * Se o visitante não tiver permissão de ver (perfil privado, ou
 * biblioteca restrita a seguidores e ele não segue), a RLS
 * simplesmente devolve zero linhas — não é um erro, a tela mostra
 * biblioteca vazia. É por isso que esta tela NUNCA deveria assumir
 * "vazio = realmente vazio"; ver PublicLibrarySection pro texto
 * usado nesse caso.
 */
export function usePublicLibraryItems(userId: string | null) {
  return useQuery({
    queryKey: ["public-library", userId],
    queryFn: async (): Promise<LibraryItem[]> => {
      if (!userId) return [];
      const supabase = createClient();

      const [movieResult, seriesResult, episodeResult] = await Promise.all([
        supabase.from("movie_status").select("movie_id, status, created_at, updated_at").eq("user_id", userId),
        supabase.from("series_status").select("series_id, status, created_at, updated_at, total_watch_events").eq("user_id", userId),
        supabase.from("watched_episodes").select("series_id, watched_at").eq("user_id", userId).eq("is_special", false),
      ]);

      if (movieResult.error) {
        console.error("[public-library] Falha ao buscar movie_status", describeSupabaseError(movieResult.error));
        throw movieResult.error;
      }
      if (seriesResult.error) {
        console.error("[public-library] Falha ao buscar series_status", describeSupabaseError(seriesResult.error));
        throw seriesResult.error;
      }
      if (episodeResult.error) {
        console.error("[public-library] Falha ao buscar watched_episodes", describeSupabaseError(episodeResult.error));
        throw episodeResult.error;
      }

      const movieRows = (movieResult.data ?? []) as MovieStatusRow[];
      const seriesRows = (seriesResult.data ?? []) as SeriesStatusRow[];
      const episodeRows = (episodeResult.data ?? []) as WatchedEpisodeRow[];

      const validSeriesIds = new Set<number>([
        ...seriesRows.filter((row) => row.status !== "removed").map((row) => row.series_id),
        ...episodeRows.map((row) => row.series_id),
      ]);
      for (const row of seriesRows) {
        if (row.status === "removed") validSeriesIds.delete(row.series_id);
      }

      const summaries = await fetchDisplaySummaries(
        movieRows.map((row) => row.movie_id),
        [...validSeriesIds]
      );

      return buildLibraryItemsFromRows(movieRows, seriesRows, episodeRows, summaries);
    },
    enabled: Boolean(userId),
  });
}
