import { useQuery } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";

const WATCHED_EPISODES_PAGE_SIZE = 1000;
const MONTH_NAMES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_NAMES_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DEFAULT_EPISODE_RUNTIME_MINUTES = 45;
const MAX_POSTERS_PER_GROUP = 4;

type MediaSummaryLite = { id: number; title: string; posterPath: string | null; runtimeMinutes?: number; genres?: string[] };

/**
 * A PEDIDO — "pôster como protagonista": toda métrica que puder
 * apontar pra uma série/filme específico, aponta. `PosterRef` é o
 * formato mínimo que qualquer tela precisa pra mostrar um pôster com
 * contexto (id, título, caminho do pôster, se é série ou filme).
 */
export interface PosterRef {
  id: number;
  title: string;
  posterPath: string | null;
  mediaType: "series" | "movie";
}

export interface YearInReview {
  year: number;
  totalMinutesWatched: number;
  totalEpisodesWatched: number;
  totalMoviesWatched: number;
  topSeries: { id: number; title: string; posterPath: string | null; episodeCount: number } | null;
  topSeriesRanking: { id: number; title: string; posterPath: string | null; episodeCount: number }[];
  /** Todo pôster único (série + filme) assistido no ano — pra tela "mural". */
  allPosters: PosterRef[];
  monthlyActivity: { name: string; count: number; posters: PosterRef[] }[];
  mostActiveMonth: { name: string; count: number; posters: PosterRef[] } | null;
  favoriteWeekday: { name: string; count: number } | null;
  topGenres: { name: string; count: number; posters: PosterRef[] }[];
  topGenre: { name: string; count: number; posters: PosterRef[] } | null;
  activityPercentile: number | null;
  dailyActivity: { date: string; count: number }[];
  /** O dia com mais atividade — agora com a série que mais contribuiu naquele dia específico. */
  biggestBingeDay: { date: string; count: number; series: PosterRef | null } | null;
  longestStreakDays: number;
  /** Período do dia favorito — agora com a série que mais foi assistida naquele período. */
  favoriteTimeOfDay: { period: "dawn" | "morning" | "afternoon" | "night"; count: number; series: PosterRef | null } | null;
  seriesStartedCount: number;
  seriesCompletedCount: number;
  /** As séries recém-iniciadas no ano (até um limite) — pra tela "mural" das iniciadas. */
  startedSeriesPosters: PosterRef[];
  /** Primeiro e último episódio/filme assistido no ano, cronologicamente. */
  firstWatchedOfYear: PosterRef | null;
  lastWatchedOfYear: PosterRef | null;
}

function emptyYearInReview(year: number): YearInReview {
  return {
    year,
    totalMinutesWatched: 0,
    totalEpisodesWatched: 0,
    totalMoviesWatched: 0,
    topSeries: null,
    topSeriesRanking: [],
    allPosters: [],
    monthlyActivity: MONTH_NAMES_PT.map((name) => ({ name, count: 0, posters: [] })),
    mostActiveMonth: null,
    favoriteWeekday: null,
    topGenres: [],
    topGenre: null,
    activityPercentile: null,
    dailyActivity: [],
    biggestBingeDay: null,
    longestStreakDays: 0,
    favoriteTimeOfDay: null,
    seriesStartedCount: 0,
    seriesCompletedCount: 0,
    startedSeriesPosters: [],
    firstWatchedOfYear: null,
    lastWatchedOfYear: null,
  };
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function timeOfDayPeriod(hour: number): "dawn" | "morning" | "afternoon" | "night" {
  if (hour < 6) return "dawn";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "night";
}

/**
 * A PEDIDO — mudança de filosofia: de "painel de estatística" pra
 * "pôster é o protagonista, número conta a história por trás dele".
 * Toda métrica que faz sentido apontar pra uma série/filme específico
 * agora carrega isso (`PosterRef`) — maior maratona, horário
 * favorito, mês mais ativo, gênero favorito, primeiro/último
 * episódio do ano — nenhuma dessas ficava mais "abstrata" do que
 * precisava antes.
 */
export async function computeYearInReview(year: number): Promise<YearInReview> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) return emptyYearInReview(year);

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const { count: episodeCount } = await supabase
    .from("watched_episodes")
    .select("series_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_special", false)
    .gte("watched_at", yearStart)
    .lt("watched_at", yearEnd);

  const episodePageCount = Math.ceil((episodeCount ?? 0) / WATCHED_EPISODES_PAGE_SIZE);
  const episodePages = await Promise.all(
    Array.from({ length: episodePageCount }, (_, index) => {
      const from = index * WATCHED_EPISODES_PAGE_SIZE;
      return supabase
        .from("watched_episodes")
        .select("series_id, watched_at")
        .eq("user_id", user.id)
        .eq("is_special", false)
        .gte("watched_at", yearStart)
        .lt("watched_at", yearEnd)
        .range(from, from + WATCHED_EPISODES_PAGE_SIZE - 1);
    })
  );
  const watchedEpisodes = episodePages.flatMap((page) => page.data ?? []);

  const { data: movieRows } = await supabase
    .from("movie_status")
    .select("movie_id, updated_at")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("updated_at", yearStart)
    .lt("updated_at", yearEnd);
  const watchedMovies = movieRows ?? [];

  const [{ count: seriesStartedCount }, { data: startedRows }, { count: seriesCompletedCount }] = await Promise.all([
    supabase
      .from("series_status")
      .select("series_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd),
    supabase
      .from("series_status")
      .select("series_id")
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd)
      .limit(24),
    supabase
      .from("series_status")
      .select("series_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("updated_at", yearStart)
      .lt("updated_at", yearEnd),
  ]);

  if (watchedEpisodes.length === 0 && watchedMovies.length === 0) {
    return { ...emptyYearInReview(year), seriesStartedCount: seriesStartedCount ?? 0, seriesCompletedCount: seriesCompletedCount ?? 0 };
  }

  const episodeCountBySeriesId = new Map<number, number>();
  for (const row of watchedEpisodes) {
    episodeCountBySeriesId.set(row.series_id, (episodeCountBySeriesId.get(row.series_id) ?? 0) + 1);
  }
  const seriesRanking = [...episodeCountBySeriesId.entries()].sort((a, b) => b[1] - a[1]);
  const top5SeriesIds = seriesRanking.slice(0, 5).map(([id]) => id);
  const topSeriesId = top5SeriesIds[0] ?? null;

  const uniqueSeriesIds = [...new Set([...episodeCountBySeriesId.keys(), ...(startedRows ?? []).map((r) => r.series_id)])];
  const uniqueMovieIds = [...new Set(watchedMovies.map((m) => m.movie_id))];
  let seriesSummaries: MediaSummaryLite[] = [];
  let movieSummaries: MediaSummaryLite[] = [];
  try {
    const response = await fetch("/api/tmdb/library-summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds: uniqueMovieIds, seriesIds: uniqueSeriesIds }),
    });
    if (response.ok) {
      const data = (await response.json()) as { movies: MediaSummaryLite[]; series: MediaSummaryLite[] };
      movieSummaries = data.movies;
      seriesSummaries = data.series;
    }
  } catch (error) {
    console.error("[computeYearInReview] Falha ao buscar resumos em lote", error);
  }
  const seriesSummaryById = new Map(seriesSummaries.map((s) => [s.id, s]));
  const movieSummaryById = new Map(movieSummaries.map((m) => [m.id, m]));

  function seriesPoster(id: number): PosterRef | null {
    const summary = seriesSummaryById.get(id);
    return summary ? { id, title: summary.title, posterPath: summary.posterPath, mediaType: "series" } : null;
  }
  function moviePoster(id: number): PosterRef | null {
    const summary = movieSummaryById.get(id);
    return summary ? { id, title: summary.title, posterPath: summary.posterPath, mediaType: "movie" } : null;
  }

  let totalMinutesWatched = 0;
  for (const [seriesId, count] of episodeCountBySeriesId) {
    const runtimeMinutes = seriesSummaryById.get(seriesId)?.runtimeMinutes ?? DEFAULT_EPISODE_RUNTIME_MINUTES;
    totalMinutesWatched += runtimeMinutes * count;
  }
  for (const movieId of uniqueMovieIds) {
    totalMinutesWatched += movieSummaryById.get(movieId)?.runtimeMinutes ?? 0;
  }

  // Varredura única: mês (com quais séries), dia (com quais séries), período do dia (com quais séries), dia da semana.
  const monthCounts = new Array(12).fill(0);
  const monthSeriesIds: Set<number>[] = Array.from({ length: 12 }, () => new Set());
  const weekdayCounts = new Array(7).fill(0);
  const dailyCounts = new Map<string, number>();
  const dailySeriesCounts = new Map<string, Map<number, number>>();
  const periodTotals: Record<"dawn" | "morning" | "afternoon" | "night", number> = { dawn: 0, morning: 0, afternoon: 0, night: 0 };
  const periodSeriesCounts: Record<"dawn" | "morning" | "afternoon" | "night", Map<number, number>> = {
    dawn: new Map(),
    morning: new Map(),
    afternoon: new Map(),
    night: new Map(),
  };
  let firstEntry: { dateIso: string; seriesId?: number; movieId?: number } | null = null;
  let lastEntry: { dateIso: string; seriesId?: number; movieId?: number } | null = null;

  function recordActivity(dateIso: string, seriesId?: number, movieId?: number) {
    const date = new Date(dateIso);
    monthCounts[date.getMonth()] += 1;
    if (seriesId != null) monthSeriesIds[date.getMonth()]?.add(seriesId);
    weekdayCounts[date.getDay()] += 1;

    const dayKey = localDateKey(date);
    dailyCounts.set(dayKey, (dailyCounts.get(dayKey) ?? 0) + 1);
    if (seriesId != null) {
      const perSeries = dailySeriesCounts.get(dayKey) ?? new Map<number, number>();
      perSeries.set(seriesId, (perSeries.get(seriesId) ?? 0) + 1);
      dailySeriesCounts.set(dayKey, perSeries);
    }

    const period = timeOfDayPeriod(date.getHours());
    periodTotals[period] += 1;
    if (seriesId != null) periodSeriesCounts[period].set(seriesId, (periodSeriesCounts[period].get(seriesId) ?? 0) + 1);

    if (!firstEntry || dateIso < firstEntry.dateIso) firstEntry = { dateIso, seriesId, movieId };
    if (!lastEntry || dateIso > lastEntry.dateIso) lastEntry = { dateIso, seriesId, movieId };
  }
  for (const row of watchedEpisodes) recordActivity(row.watched_at, row.series_id, undefined);
  for (const row of watchedMovies) recordActivity(row.updated_at, undefined, row.movie_id);

  const topMonthIndex = monthCounts.indexOf(Math.max(...monthCounts));
  const topWeekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
  const topWeekdayName = WEEKDAY_NAMES_PT[topWeekdayIndex] ?? "";

  const monthlyActivity = MONTH_NAMES_PT.map((name, i) => ({
    name,
    count: monthCounts[i],
    posters: [...(monthSeriesIds[i] ?? [])]
      .map((id) => seriesPoster(id))
      .filter((p): p is PosterRef => p !== null)
      .slice(0, MAX_POSTERS_PER_GROUP),
  }));

  const dailyActivity = [...dailyCounts.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));
  const biggestBingeEntry = [...dailyCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  let biggestBingeSeries: PosterRef | null = null;
  if (biggestBingeEntry) {
    const perSeries = dailySeriesCounts.get(biggestBingeEntry[0]);
    const topId = perSeries ? [...perSeries.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : null;
    biggestBingeSeries = topId != null ? seriesPoster(topId) : null;
  }

  let longestStreakDays = 0;
  let currentStreak = 0;
  let previousDate: Date | null = null;
  for (const { date } of dailyActivity) {
    const current = new Date(`${date}T00:00:00`);
    if (previousDate) {
      const diffDays = Math.round((current.getTime() - previousDate.getTime()) / (24 * 60 * 60 * 1000));
      currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
    } else {
      currentStreak = 1;
    }
    longestStreakDays = Math.max(longestStreakDays, currentStreak);
    previousDate = current;
  }

  const topPeriodEntry = (Object.entries(periodTotals) as ["dawn" | "morning" | "afternoon" | "night", number][]).sort((a, b) => b[1] - a[1])[0];
  let favoriteTimeSeries: PosterRef | null = null;
  if (topPeriodEntry && topPeriodEntry[1] > 0) {
    const perSeries = periodSeriesCounts[topPeriodEntry[0]];
    const topId = [...perSeries.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    favoriteTimeSeries = topId != null ? seriesPoster(topId) : null;
  }

  const genreCounts = new Map<string, number>();
  const genrePosterIds = new Map<string, Set<string>>(); // "series-123" ou "movie-45"
  function addGenreHit(genres: string[] | undefined, ref: { key: string }, weight: number) {
    for (const genre of genres ?? []) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + weight);
      const set = genrePosterIds.get(genre) ?? new Set<string>();
      set.add(ref.key);
      genrePosterIds.set(genre, set);
    }
  }
  for (const [seriesId, count] of episodeCountBySeriesId) {
    addGenreHit(seriesSummaryById.get(seriesId)?.genres, { key: `series-${seriesId}` }, count);
  }
  for (const movieId of uniqueMovieIds) {
    addGenreHit(movieSummaryById.get(movieId)?.genres, { key: `movie-${movieId}` }, 1);
  }
  const genreRanking = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topGenres = genreRanking.slice(0, 3).map(([name, count]) => {
    const posters = [...(genrePosterIds.get(name) ?? [])]
      .map((key) => {
        const [kind, idStr] = key.split("-");
        const id = Number(idStr);
        return kind === "series" ? seriesPoster(id) : moviePoster(id);
      })
      .filter((p): p is PosterRef => p !== null)
      .slice(0, MAX_POSTERS_PER_GROUP);
    return { name, count, posters };
  });

  let activityPercentile: number | null = null;
  try {
    const { data: percentileData, error: percentileError } = await supabase.rpc("get_year_activity_percentile", { p_year: year });
    // DIAGNÓSTICO TEMPORÁRIO — o Supabase costuma devolver erro como
    // DADO (não lança exceção), então um erro real passava batido
    // sem nenhum log antes. Log explícito nos 3 casos possíveis.
    if (percentileError) {
      console.error("[computeYearInReview] RPC get_year_activity_percentile devolveu erro (sem lançar exceção)", percentileError);
    } else if (typeof percentileData !== "number") {
      console.warn("[computeYearInReview] RPC get_year_activity_percentile devolveu valor inesperado", percentileData);
    } else {
      console.log("[computeYearInReview] RPC get_year_activity_percentile OK", percentileData);
      activityPercentile = percentileData;
    }
  } catch (error) {
    console.error("[computeYearInReview] Falha ao calcular percentil de atividade (exceção)", error);
  }

  const topSeriesRanking = top5SeriesIds
    .map((id) => {
      const summary = seriesSummaryById.get(id);
      if (!summary) return null;
      return { id, title: summary.title, posterPath: summary.posterPath, episodeCount: episodeCountBySeriesId.get(id) ?? 0 };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const allPostersMap = new Map<string, PosterRef>();
  for (const id of uniqueSeriesIds) {
    const ref = seriesPoster(id);
    if (ref?.posterPath) allPostersMap.set(`series-${id}`, ref);
  }
  for (const id of uniqueMovieIds) {
    const ref = moviePoster(id);
    if (ref?.posterPath) allPostersMap.set(`movie-${id}`, ref);
  }

  const startedSeriesPosters = (startedRows ?? [])
    .map((row) => seriesPoster(row.series_id))
    .filter((p): p is PosterRef => p !== null && p.posterPath !== null);

  const firstWatched = firstEntry as { dateIso: string; seriesId?: number; movieId?: number } | null;
  const lastWatched = lastEntry as { dateIso: string; seriesId?: number; movieId?: number } | null;

  return {
    year,
    totalMinutesWatched,
    totalEpisodesWatched: watchedEpisodes.length,
    totalMoviesWatched: watchedMovies.length,
    topSeries: topSeriesRanking[0] ?? null,
    topSeriesRanking,
    allPosters: [...allPostersMap.values()],
    monthlyActivity,
    mostActiveMonth: monthCounts[topMonthIndex] > 0 ? monthlyActivity[topMonthIndex] ?? null : null,
    favoriteWeekday: weekdayCounts[topWeekdayIndex] > 0 ? { name: topWeekdayName, count: weekdayCounts[topWeekdayIndex] } : null,
    topGenres,
    topGenre: topGenres[0] ?? null,
    activityPercentile,
    dailyActivity,
    biggestBingeDay: biggestBingeEntry ? { date: biggestBingeEntry[0], count: biggestBingeEntry[1], series: biggestBingeSeries } : null,
    longestStreakDays,
    favoriteTimeOfDay:
      topPeriodEntry && topPeriodEntry[1] > 0 ? { period: topPeriodEntry[0], count: topPeriodEntry[1], series: favoriteTimeSeries } : null,
    seriesStartedCount: seriesStartedCount ?? 0,
    seriesCompletedCount: seriesCompletedCount ?? 0,
    startedSeriesPosters,
    firstWatchedOfYear: firstWatched
      ? (firstWatched.seriesId != null ? seriesPoster(firstWatched.seriesId) : firstWatched.movieId != null ? moviePoster(firstWatched.movieId) : null)
      : null,
    lastWatchedOfYear: lastWatched
      ? (lastWatched.seriesId != null ? seriesPoster(lastWatched.seriesId) : lastWatched.movieId != null ? moviePoster(lastWatched.movieId) : null)
      : null,
  };
}

export function useYearInReview(year: number) {
  return useQuery({
    queryKey: ["year-in-review", year],
    queryFn: () => computeYearInReview(year),
    staleTime: 60 * 60 * 1000,
  });
}
