import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import { fetchAllWatchedEpisodeRows } from "./library-state";

/**
 * TASK-177 — Perfil, redesign a pedido (referências trazidas de
 * outros apps): "Séries"/"Filmes"/"Séries favoritas"/"Filmes
 * favoritos" deixam de ser só uma linha com número e viram
 * carrossel de pôster de verdade, ordenado por atividade mais
 * recente. Esses hooks só calculam a ORDEM (lista de IDs) — a busca
 * de pôster/título de cada item continua vindo de
 * `fetchDisplaySummaries`, paginada conforme o carrossel rola
 * (`ProfileMediaCarousel.tsx`), pra não buscar resumo de centenas de
 * itens de uma vez só.
 *
 * "Atividade mais recente" pra série: o mais recente entre
 * `series_status.updated_at` (quando tem) e o `watched_at` mais
 * recente entre os episódios dela — cobre tanto quem só mexeu no
 * status (ex.: marcou "Assistir depois") quanto quem só marcou
 * episódio direto (sem nunca abrir o seletor de status).
 */
export function useSeriesActivityIds(userId: string | null) {
  return useQuery({
    queryKey: ["profile-series-activity-ids", userId ?? ""],
    queryFn: async (): Promise<number[]> => {
      if (!userId) return [];
      const supabase = createClient();

      const [statusResult, episodeRows] = await Promise.all([
        supabase.from("series_status").select("series_id, status, updated_at").eq("user_id", userId),
        fetchAllWatchedEpisodeRows(supabase, userId),
      ]);
      if (statusResult.error) {
        console.error("[profile-media-carousel] Falha ao buscar series_status", describeSupabaseError(statusResult.error));
      }

      const lastActivityBySeriesId = new Map<number, number>();
      const removedIds = new Set<number>();

      for (const row of statusResult.data ?? []) {
        if (row.status === "removed") {
          removedIds.add(row.series_id);
          continue;
        }
        lastActivityBySeriesId.set(row.series_id, new Date(row.updated_at).getTime());
      }
      for (const row of episodeRows) {
        const watchedAtMs = new Date(row.watched_at as string).getTime();
        const current = lastActivityBySeriesId.get(row.series_id);
        if (!current || watchedAtMs > current) {
          lastActivityBySeriesId.set(row.series_id, watchedAtMs);
        }
      }
      for (const id of removedIds) {
        lastActivityBySeriesId.delete(id);
      }

      return [...lastActivityBySeriesId.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

/** Mesma ideia, mais simples — filme não tem episódio, só `movie_status.updated_at`. */
export function useMovieActivityIds(userId: string | null) {
  return useQuery({
    queryKey: ["profile-movie-activity-ids", userId ?? ""],
    queryFn: async (): Promise<number[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("movie_status")
        .select("movie_id, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) {
        console.error("[profile-media-carousel] Falha ao buscar movie_status", describeSupabaseError(error));
        return [];
      }
      return (data ?? []).map((row) => row.movie_id as number);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}

/** Favoritos: ordenado por quando foi favoritado (mais recente primeiro), não por atividade de assistir. */
export function useFavoriteIds(userId: string | null, mediaType: "movie" | "series") {
  return useQuery({
    queryKey: ["profile-favorite-ids", userId ?? "", mediaType],
    queryFn: async (): Promise<number[]> => {
      if (!userId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from("favorites")
        .select("media_id, created_at")
        .eq("user_id", userId)
        .eq("media_type", mediaType)
        .order("created_at", { ascending: false });
      if (error) {
        console.error("[profile-media-carousel] Falha ao buscar favoritos", describeSupabaseError(error));
        return [];
      }
      return (data ?? []).map((row) => row.media_id as number);
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
