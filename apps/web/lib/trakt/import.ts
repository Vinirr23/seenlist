import { createClient, getCurrentAuthUser } from "@/lib/supabase/client";
import type { TraktImportData } from "@/app/api/trakt/data/route";

export interface TraktImportResult {
  moviesWatched: number;
  moviesWantToWatch: number;
  seriesWithEpisodes: number;
  episodesImported: number;
  seriesWantToWatch: number;
  reviewsImported: number;
}

/** Trakt usa 1-10 inteiro; SeenList usa 0-5 com meio-ponto. Conversão direta, sem arredondamento estranho (Trakt é sempre inteiro). */
function convertTraktRating(traktRating: number): number {
  return traktRating / 2;
}

/**
 * TASK-171 — grava no Supabase com o cliente normal do navegador
 * (RLS de sempre, é dado do próprio usuário) — decisão confirmada:
 * MESCLA com o que já existe, nunca substitui. Duas regras de
 * mesclagem:
 *   1. "Assistido" (filme) e episódio assistido (série) sempre
 *      entram — é um fato objetivo, sobrescrever aqui não perde
 *      informação nenhuma do usuário.
 *   2. "Assistir depois" (watchlist do Trakt) só entra quando NÃO
 *      existir status nenhum ainda pra aquele filme/série (e,
 *      pra série, também não pode ter episódio já assistido) — não
 *      faz sentido "rebaixar" uma série que a pessoa já está
 *      assistindo pra "assistir depois" só porque estava na
 *      watchlist antiga do Trakt.
 *   Avaliação (rating) sempre entra — é aditivo, não apaga nada
 *   (`useUpsertReview` só mexe no campo `rating`, mesmo padrão já
 *   usado no resto do app).
 */
export async function importTraktData(
  data: TraktImportData,
  onProgress?: (message: string) => void
): Promise<TraktImportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await getCurrentAuthUser(supabase);
  if (!user) throw new Error("not authenticated");

  const result: TraktImportResult = {
    moviesWatched: 0,
    moviesWantToWatch: 0,
    seriesWithEpisodes: 0,
    episodesImported: 0,
    seriesWantToWatch: 0,
    reviewsImported: 0,
  };

  // === Filmes ===
  onProgress?.("Verificando status atual dos filmes...");
  const movieIds = data.movies.map((m) => m.tmdbId);
  const { data: existingMovieStatuses } = await supabase
    .from("movie_status")
    .select("movie_id")
    .eq("user_id", user.id)
    .in("movie_id", movieIds.length > 0 ? movieIds : [-1]);
  const moviesWithExistingStatus = new Set((existingMovieStatuses ?? []).map((r) => r.movie_id));

  onProgress?.("Importando filmes...");
  const movieStatusRows: { user_id: string; movie_id: number; status: string }[] = [];
  for (const movie of data.movies) {
    if (movie.watched) {
      movieStatusRows.push({ user_id: user.id, movie_id: movie.tmdbId, status: "watched" });
      result.moviesWatched++;
    } else if (movie.wantToWatch && !moviesWithExistingStatus.has(movie.tmdbId)) {
      movieStatusRows.push({ user_id: user.id, movie_id: movie.tmdbId, status: "want_to_watch" });
      result.moviesWantToWatch++;
    }
  }
  if (movieStatusRows.length > 0) {
    const { error } = await supabase.from("movie_status").upsert(movieStatusRows, { onConflict: "user_id,movie_id" });
    if (error) throw error;
  }

  // === Séries — episódios assistidos ===
  onProgress?.("Importando episódios assistidos...");
  for (const series of data.series) {
    if (series.watchedEpisodes.length === 0) continue;
    const rows = series.watchedEpisodes.map((e) => ({
      user_id: user.id,
      series_id: series.tmdbId,
      season_number: e.seasonNumber,
      episode_number: e.episodeNumber,
    }));
    const { error } = await supabase
      .from("watched_episodes")
      .upsert(rows, { onConflict: "user_id,series_id,season_number,episode_number", ignoreDuplicates: true });
    if (error) throw error;
    result.seriesWithEpisodes++;
    result.episodesImported += rows.length;
  }

  // === Séries — assistir depois (só quando genuinamente sem status nem episódio assistido) ===
  onProgress?.("Verificando status atual das séries...");
  const seriesIds = data.series.map((s) => s.tmdbId);
  const [{ data: existingSeriesStatuses }, { data: existingWatchedSeriesIds }] = await Promise.all([
    supabase.from("series_status").select("series_id").eq("user_id", user.id).in("series_id", seriesIds.length > 0 ? seriesIds : [-1]),
    supabase.from("watched_episodes").select("series_id").eq("user_id", user.id).in("series_id", seriesIds.length > 0 ? seriesIds : [-1]),
  ]);
  const seriesWithExistingStatus = new Set((existingSeriesStatuses ?? []).map((r) => r.series_id));
  const seriesWithAnyWatchedEpisode = new Set((existingWatchedSeriesIds ?? []).map((r) => r.series_id));

  const seriesStatusRows: { user_id: string; series_id: number; status: string }[] = [];
  for (const series of data.series) {
    if (series.watchedEpisodes.length > 0) continue; // já tratado acima — não é "assistir depois"
    if (series.wantToWatch && !seriesWithExistingStatus.has(series.tmdbId) && !seriesWithAnyWatchedEpisode.has(series.tmdbId)) {
      seriesStatusRows.push({ user_id: user.id, series_id: series.tmdbId, status: "want_to_watch" });
      result.seriesWantToWatch++;
    }
  }
  if (seriesStatusRows.length > 0) {
    const { error } = await supabase.from("series_status").upsert(seriesStatusRows, { onConflict: "user_id,series_id" });
    if (error) throw error;
  }

  // === Avaliações (filme e série) ===
  onProgress?.("Importando avaliações...");
  const reviewRows: {
    user_id: string;
    media_type: "movie" | "series";
    media_id: number;
    season_number: null;
    episode_number: null;
    rating: number;
    updated_at: string;
    deleted_at: null;
  }[] = [];
  const now = new Date().toISOString();
  for (const movie of data.movies) {
    if (movie.rating === null) continue;
    reviewRows.push({
      user_id: user.id,
      media_type: "movie",
      media_id: movie.tmdbId,
      season_number: null,
      episode_number: null,
      rating: convertTraktRating(movie.rating),
      updated_at: now,
      deleted_at: null,
    });
  }
  for (const series of data.series) {
    if (series.rating === null) continue;
    reviewRows.push({
      user_id: user.id,
      media_type: "series",
      media_id: series.tmdbId,
      season_number: null,
      episode_number: null,
      rating: convertTraktRating(series.rating),
      updated_at: now,
      deleted_at: null,
    });
  }
  if (reviewRows.length > 0) {
    const { error } = await supabase
      .from("reviews")
      .upsert(reviewRows, { onConflict: "user_id,media_type,media_id,season_number,episode_number" });
    if (error) throw error;
    result.reviewsImported = reviewRows.length;
  }

  return result;
}
