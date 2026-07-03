import { useMemo } from "react";
import { useLibraryItems, LIBRARY_QUERY_KEY } from "./library-state";
import { useRealtimeInvalidate } from "@/lib/supabase/useRealtimeInvalidate";

const REALTIME_TABLES = ["movie_status", "series_status", "watched_episodes"] as const;

export interface UserStats {
  moviesWatched: number;
  seriesWatched: number;
  episodesWatched: number;
}

/**
 * "Perfil: atualizar automaticamente — filmes assistidos, séries
 * assistidas, episódios assistidos" (TASK-009). Em vez de repetir a
 * mesma leitura de `movie_status`/`series_status`/`watched_episodes`
 * que a Biblioteca já faz (com a mesma derivação de status de série
 * a partir dos episódios), este hook só agrega o que
 * `useLibraryItems` já devolve — nenhuma chamada nova ao Supabase ou
 * ao TMDB. "Calcular automaticamente, não criar tabela de cache"
 * também fica satisfeito por construção: não existe nenhuma tabela
 * nova aqui, é tudo derivado em memória a cada render.
 *
 * Avaliações e comentários não entram — TASK-009 pede os dois no
 * Perfil, mas também proíbe implementar comentários, e nenhuma
 * tabela de avaliação existe. Ver docs/review/FLOW_REVIEW.md.
 */
export function useUserStats() {
  const libraryQuery = useLibraryItems();
  useRealtimeInvalidate(REALTIME_TABLES, LIBRARY_QUERY_KEY);

  const stats = useMemo<UserStats | undefined>(() => {
    if (!libraryQuery.data) return undefined;

    let moviesWatched = 0;
    let seriesWatched = 0;
    let episodesWatched = 0;

    for (const item of libraryQuery.data) {
      if (item.mediaType === "movie" && item.status === "completed") {
        moviesWatched += 1;
      }
      if (item.mediaType === "series") {
        episodesWatched += item.progress?.watchedEpisodes ?? 0;
        if (item.status === "completed") {
          seriesWatched += 1;
        }
      }
    }

    return { moviesWatched, seriesWatched, episodesWatched };
  }, [libraryQuery.data]);

  return { ...libraryQuery, data: stats };
}
