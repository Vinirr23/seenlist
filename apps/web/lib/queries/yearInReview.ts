import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getCurrentAuthUser } from "@/lib/supabase/client";

const WATCHED_EPISODES_PAGE_SIZE = 1000;
const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const WEEKDAY_NAMES_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DEFAULT_EPISODE_RUNTIME_MINUTES = 45;

export interface YearInReview {
  year: number;
  totalMinutesWatched: number;
  totalEpisodesWatched: number;
  totalMoviesWatched: number;
  topSeries: { id: number; title: string; posterPath: string | null; episodeCount: number } | null;
  mostActiveMonth: { name: string; count: number } | null;
  favoriteWeekday: { name: string; count: number } | null;
  topGenre: { name: string; count: number } | null;
}

/**
 * A PEDIDO — "Seu ano" (resumo anual, tipo Spotify Wrapped).
 *
 * Fonte de cada métrica:
 * - Episódio: `watched_episodes.watched_at` — data real de quando
 *   foi marcado, sem ambiguidade.
 * - Filme: `movie_status.updated_at` (só existe essa coluna — não
 *   tem um "watched_at" dedicado). Aproximação aceita de propósito:
 *   se a pessoa mudar o status de um filme DEPOIS de já ter marcado
 *   assistido (raro), a data usada aqui reflete a mudança mais
 *   recente, não a data original. Resolver isso direito exigiria uma
 *   coluna nova + migration — fora do escopo desta primeira versão.
 * - Gênero favorito: conta 1 ocorrência de cada gênero POR EPISÓDIO
 *   assistido (não por série) — uma série que a pessoa maratonou
 *   pesa mais que uma que só viu 1-2 episódios, de propósito (reflete
 *   tempo de consumo, não só "quantos títulos diferentes").
 */
export async function computeYearInReview(year: number): Promise<YearInReview> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) {
    return {
      year,
      totalMinutesWatched: 0,
      totalEpisodesWatched: 0,
      totalMoviesWatched: 0,
      topSeries: null,
      mostActiveMonth: null,
      favoriteWeekday: null,
      topGenre: null,
    };
  }

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  // 1. Episódios assistidos no ano (paginado — pode passar de 1000 linhas pra quem maratona muito).
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

  // 2. Filmes concluídos no ano.
  const { data: movieRows } = await supabase
    .from("movie_status")
    .select("movie_id, updated_at")
    .eq("user_id", user.id)
    .eq("status", "completed")
    .gte("updated_at", yearStart)
    .lt("updated_at", yearEnd);
  const watchedMovies = movieRows ?? [];

  if (watchedEpisodes.length === 0 && watchedMovies.length === 0) {
    return {
      year,
      totalMinutesWatched: 0,
      totalEpisodesWatched: 0,
      totalMoviesWatched: 0,
      topSeries: null,
      mostActiveMonth: null,
      favoriteWeekday: null,
      topGenre: null,
    };
  }

  // 3. Série favorita (mais episódios assistidos no ano).
  const episodeCountBySeriesId = new Map<number, number>();
  for (const row of watchedEpisodes) {
    episodeCountBySeriesId.set(row.series_id, (episodeCountBySeriesId.get(row.series_id) ?? 0) + 1);
  }
  const topSeriesId = [...episodeCountBySeriesId.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // 4. Resumos (título, pôster, duração, gênero) de toda série/filme único envolvido — em lote, uma chamada só.
  const uniqueSeriesIds = [...episodeCountBySeriesId.keys()];
  const uniqueMovieIds = [...new Set(watchedMovies.map((m) => m.movie_id))];
  let seriesSummaries: { id: number; title: string; posterPath: string | null; runtimeMinutes?: number; genres?: string[] }[] = [];
  let movieSummaries: { id: number; title: string; posterPath: string | null; runtimeMinutes?: number; genres?: string[] }[] = [];
  try {
    const response = await fetch("/api/tmdb/library-summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ movieIds: uniqueMovieIds, seriesIds: uniqueSeriesIds }),
    });
    if (response.ok) {
      const data = (await response.json()) as { movies: typeof movieSummaries; series: typeof seriesSummaries };
      movieSummaries = data.movies;
      seriesSummaries = data.series;
    }
  } catch (error) {
    console.error("[computeYearInReview] Falha ao buscar resumos em lote", error);
  }
  const seriesSummaryById = new Map(seriesSummaries.map((s) => [s.id, s]));
  const movieSummaryById = new Map(movieSummaries.map((m) => [m.id, m]));

  // 5. Minutos totais — episódio usa a duração média da série; filme usa a duração real.
  let totalMinutesWatched = 0;
  for (const [seriesId, count] of episodeCountBySeriesId) {
    const runtimeMinutes = seriesSummaryById.get(seriesId)?.runtimeMinutes ?? DEFAULT_EPISODE_RUNTIME_MINUTES;
    totalMinutesWatched += runtimeMinutes * count;
  }
  for (const movieId of uniqueMovieIds) {
    totalMinutesWatched += movieSummaryById.get(movieId)?.runtimeMinutes ?? 0;
  }

  // 6. Mês mais ativo e dia da semana favorito — episódio + filme juntos, mesma distribuição de tempo.
  const monthCounts = new Array(12).fill(0);
  const weekdayCounts = new Array(7).fill(0);
  for (const row of watchedEpisodes) {
    const date = new Date(row.watched_at);
    monthCounts[date.getMonth()] += 1;
    weekdayCounts[date.getDay()] += 1;
  }
  for (const row of watchedMovies) {
    const date = new Date(row.updated_at);
    monthCounts[date.getMonth()] += 1;
    weekdayCounts[date.getDay()] += 1;
  }
  const topMonthIndex = monthCounts.indexOf(Math.max(...monthCounts));
  const topWeekdayIndex = weekdayCounts.indexOf(Math.max(...weekdayCounts));
  const topMonthName: string = MONTH_NAMES_PT[topMonthIndex] ?? "";
  const topWeekdayName: string = WEEKDAY_NAMES_PT[topWeekdayIndex] ?? "";

  // 7. Gênero favorito — 1 ocorrência por EPISÓDIO assistido (não por série), + 1 por filme.
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
  const topGenreEntry = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  const topSeriesSummary = topSeriesId != null ? seriesSummaryById.get(topSeriesId) : null;

  return {
    year,
    totalMinutesWatched,
    totalEpisodesWatched: watchedEpisodes.length,
    totalMoviesWatched: watchedMovies.length,
    topSeries:
      topSeriesId != null && topSeriesSummary
        ? {
            id: topSeriesId,
            title: topSeriesSummary.title,
            posterPath: topSeriesSummary.posterPath,
            episodeCount: episodeCountBySeriesId.get(topSeriesId) ?? 0,
          }
        : null,
    mostActiveMonth: monthCounts[topMonthIndex] > 0 ? { name: topMonthName, count: monthCounts[topMonthIndex] } : null,
    favoriteWeekday: weekdayCounts[topWeekdayIndex] > 0 ? { name: topWeekdayName, count: weekdayCounts[topWeekdayIndex] } : null,
    topGenre: topGenreEntry ? { name: topGenreEntry[0], count: topGenreEntry[1] } : null,
  };
}

export function useYearInReview(year: number) {
  return useQuery({
    queryKey: ["year-in-review", year],
    queryFn: () => computeYearInReview(year),
    staleTime: 60 * 60 * 1000, // 1h — não muda a cada segundo, é um resumo de um ano inteiro.
  });
}
