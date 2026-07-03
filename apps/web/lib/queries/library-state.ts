import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LibraryItem, LibraryStatus } from "@seenlist/types";
import { createClient } from "@/lib/supabase/client";
import type { MediaSummary } from "@/lib/tmdb/client";

export const LIBRARY_QUERY_KEY = ["library"] as const;

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
}

interface WatchedEpisodeRow {
  series_id: number;
  watched_at: string;
}

interface LibrarySummariesResponse {
  movies: MediaSummary[];
  series: MediaSummary[];
}

function toLibraryStatus(movieStatus: MovieStatusRow["status"]): LibraryStatus {
  return movieStatus === "watched" ? "completed" : movieStatus;
}

/** TMDB só decora — se a chamada falhar, a Biblioteca ainda mostra o estado real (sem poster/título), não trava sem mostrar nada. */
async function fetchDisplaySummaries(
  movieIds: number[],
  seriesIds: number[]
): Promise<{ movies: Record<number, MediaSummary>; series: Record<number, MediaSummary> }> {
  if (movieIds.length === 0 && seriesIds.length === 0) {
    return { movies: {}, series: {} };
  }

  try {
    const response = await fetch("/api/tmdb/library-summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds, seriesIds }),
    });

    if (!response.ok) {
      console.warn(`[library] /api/tmdb/library-summaries respondeu ${response.status} — exibindo itens sem poster/título.`);
      return { movies: {}, series: {} };
    }

    const data = (await response.json()) as LibrarySummariesResponse;
    return {
      movies: Object.fromEntries(data.movies.map((item) => [item.id, item])),
      series: Object.fromEntries(data.series.map((item) => [item.id, item])),
    };
  } catch (error) {
    console.warn("[library] Falha ao buscar resumos do TMDB — exibindo itens sem poster/título.", error);
    return { movies: {}, series: {} };
  }
}

/**
 * O ESTADO da biblioteca (o que está em cada aba, status, progresso
 * assistido) vem inteiramente daqui — três tabelas do Supabase, do
 * usuário logado (RLS cuida disso, não precisamos filtrar por
 * user_id nas queries). O TMDB só entra depois, pra decorar o que já
 * foi decidido aqui com poster/título/ano ("apenas para exibição").
 */
async function fetchLibraryItems(): Promise<LibraryItem[]> {
  const supabase = createClient();

  const [movieResult, seriesResult, episodeResult] = await Promise.all([
    supabase.from("movie_status").select("movie_id, status, created_at, updated_at"),
    supabase.from("series_status").select("series_id, status, created_at, updated_at"),
    supabase.from("watched_episodes").select("series_id, watched_at"),
  ]);

  if (movieResult.error) throw movieResult.error;
  if (seriesResult.error) throw seriesResult.error;
  if (episodeResult.error) throw episodeResult.error;

  const movieRows = (movieResult.data ?? []) as MovieStatusRow[];
  const seriesRows = (seriesResult.data ?? []) as SeriesStatusRow[];
  const episodeRows = (episodeResult.data ?? []) as WatchedEpisodeRow[];

  // Agrega episódios assistidos por série (contagem + data do mais recente).
  const episodeAgg = new Map<number, { count: number; lastWatchedAt: string }>();
  for (const row of episodeRows) {
    const entry = episodeAgg.get(row.series_id);
    if (!entry) {
      episodeAgg.set(row.series_id, { count: 1, lastWatchedAt: row.watched_at });
    } else {
      entry.count += 1;
      if (row.watched_at > entry.lastWatchedAt) entry.lastWatchedAt = row.watched_at;
    }
  }

  const explicitSeriesById = new Map(seriesRows.map((row) => [row.series_id, row]));

  // Uma série entra na lista se tem status explícito (e não é
  // "removed") OU se tem episódio assistido sem status explícito
  // nenhum. Ver comentário na migration series_status.sql.
  const seriesIds = new Set<number>([
    ...seriesRows.filter((row) => row.status !== "removed").map((row) => row.series_id),
    ...episodeAgg.keys(),
  ]);
  for (const row of seriesRows) {
    if (row.status === "removed") seriesIds.delete(row.series_id);
  }

  const seriesEntries = [...seriesIds].map((seriesId) => {
    const explicit = explicitSeriesById.get(seriesId);
    const agg = episodeAgg.get(seriesId);
    const watchedCount = agg?.count ?? 0;

    return {
      seriesId,
      // Status "watching" aqui é provisório quando derivado — vira
      // "completed" depois de sabermos o total de episódios do TMDB.
      status: (explicit && explicit.status !== "removed" ? explicit.status : "watching") as LibraryStatus,
      isDerived: !explicit,
      createdAt: explicit?.created_at ?? agg?.lastWatchedAt ?? new Date(0).toISOString(),
      updatedAt: explicit?.updated_at ?? agg?.lastWatchedAt ?? new Date(0).toISOString(),
      watchedCount,
    };
  });

  const movieEntries = movieRows.map((row) => ({
    movieId: row.movie_id,
    status: toLibraryStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const summaries = await fetchDisplaySummaries(
    movieEntries.map((entry) => entry.movieId),
    seriesEntries.map((entry) => entry.seriesId)
  );

  const movieItems: LibraryItem[] = movieEntries.map((entry) => {
    const summary = summaries.movies[entry.movieId];
    return {
      mediaType: "movie",
      id: entry.movieId,
      status: entry.status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      title: summary?.title ?? `Filme #${entry.movieId}`,
      year: summary?.year ?? null,
      posterPath: summary?.posterPath ?? null,
    };
  });

  const seriesItems: LibraryItem[] = seriesEntries.map((entry) => {
    const summary = summaries.series[entry.seriesId];
    const totalEpisodes = summary?.totalEpisodes ?? 0;
    const status: LibraryStatus = entry.isDerived
      ? totalEpisodes > 0 && entry.watchedCount >= totalEpisodes
        ? "completed"
        : "watching"
      : entry.status;

    return {
      mediaType: "series",
      id: entry.seriesId,
      status,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      title: summary?.title ?? `Série #${entry.seriesId}`,
      year: summary?.year ?? null,
      posterPath: summary?.posterPath ?? null,
      progress: { watchedEpisodes: entry.watchedCount, totalEpisodes },
    };
  });

  return [...movieItems, ...seriesItems];
}

export function useLibraryItems() {
  return useQuery({
    queryKey: LIBRARY_QUERY_KEY,
    queryFn: fetchLibraryItems,
  });
}

/**
 * "Atualização em tempo real sempre que o usuário alterar um status"
 * — assina mudanças nas 3 tabelas que compõem a Biblioteca e
 * invalida a query quando qualquer uma muda (em qualquer sessão/aba
 * do mesmo usuário, não só na que fez a alteração).
 */
export function useLibraryRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;

      channel = supabase
        .channel(`library-sync-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "movie_status", filter: `user_id=eq.${user.id}` },
          () => queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "series_status", filter: `user_id=eq.${user.id}` },
          () => queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "watched_episodes", filter: `user_id=eq.${user.id}` },
          () => queryClient.invalidateQueries({ queryKey: LIBRARY_QUERY_KEY })
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
