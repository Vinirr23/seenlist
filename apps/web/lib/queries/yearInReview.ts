import { useQuery } from "@tanstack/react-query";
import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";

const WATCHED_EPISODES_PAGE_SIZE = 1000;
const MONTH_NAMES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const WEEKDAY_NAMES_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DEFAULT_EPISODE_RUNTIME_MINUTES = 45;

type MediaSummaryLite = { id: number; title: string; posterPath: string | null; runtimeMinutes?: number; genres?: string[] };

export interface YearInReview {
  year: number;
  totalMinutesWatched: number;
  totalEpisodesWatched: number;
  totalMoviesWatched: number;
  topSeries: { id: number; title: string; posterPath: string | null; episodeCount: number } | null;
  /** Top 5 séries por episódios assistidos no ano — inclui a #1 (mesmo dado de `topSeries`, repetido de propósito pra quem só usa o ranking). */
  topSeriesRanking: { id: number; title: string; posterPath: string | null; episodeCount: number }[];
  /** Os 12 meses, na ordem — pro gráfico de atividade mensal. */
  monthlyActivity: { name: string; count: number }[];
  mostActiveMonth: { name: string; count: number } | null;
  favoriteWeekday: { name: string; count: number } | null;
  /** Top 3 gêneros, por quantas vezes apareceram (1 por episódio assistido, 1 por filme). */
  topGenres: { name: string; count: number }[];
  topGenre: { name: string; count: number } | null;
  activityPercentile: number | null;
  /**
   * Um "dia" aqui é uma chave YYYY-MM-DD no fuso local de quem
   * assistiu — pro heatmap (estilo GitHub) e pra maratona/sequência.
   */
  dailyActivity: { date: string; count: number }[];
  /** O dia com mais episódios/filmes assistidos de uma vez só. */
  biggestBingeDay: { date: string; count: number } | null;
  /** Maior sequência de dias seguidos com pelo menos 1 atividade. */
  longestStreakDays: number;
  /** Período do dia (madrugada/manhã/tarde/noite) em que mais assistiu, pela hora de `watched_at`. */
  favoriteTimeOfDay: { period: "dawn" | "morning" | "afternoon" | "night"; count: number } | null;
  /** Séries que a pessoa começou a assistir pela primeira vez dentro do ano (`series_status.created_at`). */
  seriesStartedCount: number;
  /** Séries concluídas dentro do ano (`series_status.status = 'completed'`, `updated_at` no ano). */
  seriesCompletedCount: number;
}

function emptyYearInReview(year: number): YearInReview {
  return {
    year,
    totalMinutesWatched: 0,
    totalEpisodesWatched: 0,
    totalMoviesWatched: 0,
    topSeries: null,
    topSeriesRanking: [],
    monthlyActivity: MONTH_NAMES_PT.map((name) => ({ name, count: 0 })),
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
  };
}

/** Chave YYYY-MM-DD no fuso LOCAL de quem está vendo — não `toISOString()` (isso converteria pra UTC, podendo trocar o dia pra quem está a oeste de Greenwich). */
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
 * A PEDIDO — "Seu ano" redesenhado inspirado em Spotify Wrapped/Steam
 * Replay/Letterboxd Year in Review: além dos números que já existiam
 * (horas, episódios, filmes, série do ano, gênero, percentual),
 * calcula tudo que uma experiência de storytelling anual precisa:
 * heatmap dia a dia, maior maratona, sequência mais longa, horário
 * favorito, ranking top 5 (não só #1), gráfico mensal completo, e
 * quantas séries foram iniciadas/concluídas no ano.
 *
 * Continua usando só o que já está no banco — nenhuma tabela nova,
 * nenhuma migration extra (fora a do percentual, já aplicada).
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

  // Séries iniciadas/concluídas no ano — consulta separada e leve (só datas, não série inteira).
  const [{ count: seriesStartedCount }, { count: seriesCompletedCount }] = await Promise.all([
    supabase
      .from("series_status")
      .select("series_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd),
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

  const uniqueSeriesIds = [...episodeCountBySeriesId.keys()];
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

  let totalMinutesWatched = 0;
  for (const [seriesId, count] of episodeCountBySeriesId) {
    const runtimeMinutes = seriesSummaryById.get(seriesId)?.runtimeMinutes ?? DEFAULT_EPISODE_RUNTIME_MINUTES;
    totalMinutesWatched += runtimeMinutes * count;
  }
  for (const movieId of uniqueMovieIds) {
    totalMinutesWatched += movieSummaryById.get(movieId)?.runtimeMinutes ?? 0;
  }

  // Atividade por mês, por dia da semana, por dia do ano (heatmap), por horário do dia — tudo na mesma varredura.
  const monthCounts = new Array(12).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  const dailyCounts = new Map<string, number>();
  const hourCounts = new Array(24).fill(0);

  function recordActivity(dateIso: string) {
    const date = new Date(dateIso);
    monthCounts[date.getMonth()] += 1;
    weekdayCounts[date.getDay()] += 1;
    hourCounts[date.getHours()] += 1;
    const key = localDateKey(date);
    dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
  }
  for (const row of watchedEpisodes) recordActivity(row.watched_at);
  for (const row of watchedMovies) recordActivity(row.updated_at);

  const topMonthIndex = monthCounts.indexOf(Math.max(...monthCounts));
  const topWeekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
  const topMonthName = MONTH_NAMES_PT[topMonthIndex] ?? "";
  const topWeekdayName = WEEKDAY_NAMES_PT[topWeekdayIndex] ?? "";

  // Maior maratona (dia com mais atividade) + maior sequência de dias seguidos.
  const dailyActivity = [...dailyCounts.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const biggestBingeEntry = [...dailyCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

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

  // Horário favorito — agrupado em período (madrugada/manhã/tarde/noite), mais fácil de contar uma história do que "14h".
  const periodTotals: Record<"dawn" | "morning" | "afternoon" | "night", number> = { dawn: 0, morning: 0, afternoon: 0, night: 0 };
  hourCounts.forEach((count, hour) => {
    periodTotals[timeOfDayPeriod(hour)] += count;
  });
  const topPeriodEntry = (Object.entries(periodTotals) as [keyof typeof periodTotals, number][]).sort((a, b) => b[1] - a[1])[0];

  // Gêneros — top 3, não só o #1.
  const genreCounts = new Map<string, number>();
  for (const [seriesId, count] of episodeCountBySeriesId) {
    for (const genre of seriesSummaryById.get(seriesId)?.genres ?? []) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + count);
    }
  }
  for (const movieId of uniqueMovieIds) {
    for (const genre of movieSummaryById.get(movieId)?.genres ?? []) {
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
  }
  const genreRanking = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topGenres = genreRanking.slice(0, 3).map(([name, count]) => ({ name, count }));

  let activityPercentile: number | null = null;
  try {
    const { data: percentileData, error: percentileError } = await supabase.rpc("get_year_activity_percentile", { p_year: year });
    if (!percentileError && typeof percentileData === "number") activityPercentile = percentileData;
  } catch (error) {
    console.error("[computeYearInReview] Falha ao calcular percentil de atividade", error);
  }

  const topSeriesRanking = top5SeriesIds
    .map((id) => {
      const summary = seriesSummaryById.get(id);
      if (!summary) return null;
      return { id, title: summary.title, posterPath: summary.posterPath, episodeCount: episodeCountBySeriesId.get(id) ?? 0 };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  return {
    year,
    totalMinutesWatched,
    totalEpisodesWatched: watchedEpisodes.length,
    totalMoviesWatched: watchedMovies.length,
    topSeries: topSeriesRanking[0] ?? null,
    topSeriesRanking,
    monthlyActivity: MONTH_NAMES_PT.map((name, i) => ({ name, count: monthCounts[i] })),
    mostActiveMonth: monthCounts[topMonthIndex] > 0 ? { name: topMonthName, count: monthCounts[topMonthIndex] } : null,
    favoriteWeekday: weekdayCounts[topWeekdayIndex] > 0 ? { name: topWeekdayName, count: weekdayCounts[topWeekdayIndex] } : null,
    topGenres,
    topGenre: topGenres[0] ?? null,
    activityPercentile,
    dailyActivity,
    biggestBingeDay: biggestBingeEntry ? { date: biggestBingeEntry[0], count: biggestBingeEntry[1] } : null,
    longestStreakDays,
    favoriteTimeOfDay: topPeriodEntry && topPeriodEntry[1] > 0 ? { period: topPeriodEntry[0], count: topPeriodEntry[1] } : null,
    seriesStartedCount: seriesStartedCount ?? 0,
    seriesCompletedCount: seriesCompletedCount ?? 0,
  };
}

export function useYearInReview(year: number) {
  return useQuery({
    queryKey: ["year-in-review", year],
    queryFn: () => computeYearInReview(year),
    staleTime: 60 * 60 * 1000,
  });
}
