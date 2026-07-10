import { createClient } from "@/lib/supabase/client";
import type { ParsedSeriesFileRow } from "../tvtime-out-import/parser/seriesParser";
import type { ParsedEpisodeRow } from "../tvtime-out-import/parser/episodesParser";
import type { ParsedMovieFileRow } from "../tvtime-out-import/parser/moviesParser";
import { filterDiscardedSeries } from "./discard";
import { filterDiscardedMovies } from "./movieDiscard";
import { matchAllSeriesNewPipeline } from "./matching";
import { matchAllMoviesNewPipeline } from "./movieMatching";
import { resolveCategory } from "./category";
import { resolveMovieCategory } from "./movieCategory";
import { reconstructEpisodes } from "./reconstruction";
import type { MigrationReport, MigrationReportRow, MovieReportRow } from "./report";

const EPISODE_CHUNK_SIZE = 500;

/**
 * TASK-035 — pipeline novo, do zero. Fluxo: CSV → Matching → TMDB →
 * Reconstrução → Categoria → Persistência, cada etapa um objeto
 * independente, guardado inteiro no relatório final — nada é
 * sobrescrito sem o motivo ficar registrado ao lado.
 */
export async function runMigration(
  seriesRows: ParsedSeriesFileRow[],
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>,
  movieRows: ParsedMovieFileRow[],
  onProgress?: (label: string, current: number, total: number) => void
): Promise<MigrationReport> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const { kept, discarded } = filterDiscardedSeries(seriesRows);

  onProgress?.("Identificando séries no TMDB…", 0, kept.length);
  const matches = await matchAllSeriesNewPipeline(kept, episodesBySeriesUuid, (done, total) =>
    onProgress?.("Identificando séries no TMDB…", done, total)
  );
  const matchByUuid = new Map(matches.map((m) => [m.seriesUuid, m]));

  const matchedTmdbIds = matches.filter((m) => m.tmdbId !== null).map((m) => m.tmdbId as number);
  onProgress?.("Buscando dados do TMDB…", 0, matchedTmdbIds.length);
  const tmdbInfoById = new Map<number, { title: string; ended: boolean }>();
  for (let start = 0; start < matchedTmdbIds.length; start += 100) {
    const batch = matchedTmdbIds.slice(start, start + 100);
    try {
      const response = await fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: batch }),
      });
      if (response.ok) {
        const data = (await response.json()) as { series: { id: number; title: string; ended: boolean }[] };
        for (const s of data.series) tmdbInfoById.set(s.id, { title: s.title, ended: s.ended });
      }
    } catch (error) {
      console.error("[tvtime-migration] Falha ao buscar lote de resumos do TMDB", error);
    }
  }

  // TASK-042 — episódios com air_date, pra decidir "Assistindo" vs "Em dia" com dado real (não só o status bruto do arquivo).
  onProgress?.("Buscando datas de exibição dos episódios…", 0, matchedTmdbIds.length);
  const episodesById = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>();
  for (let start = 0; start < matchedTmdbIds.length; start += 20) {
    const batch = matchedTmdbIds.slice(start, start + 20);
    try {
      const response = await fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: batch }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          series: { id: number; episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[] }[];
        };
        for (const s of data.series) episodesById.set(s.id, s.episodes);
      }
    } catch (error) {
      console.error("[tvtime-migration] Falha ao buscar lote de episódios com data de exibição", error);
    }
  }

  const rows: MigrationReportRow[] = [];
  let imported = 0;
  let pendingConfirmation = 0;

  for (let index = 0; index < kept.length; index++) {
    const row = kept[index];
    if (!row) continue;
    onProgress?.("Importando…", index + 1, kept.length);

    const match = matchByUuid.get(row.uuid);
    if (!match) continue;

    if (match.needsConfirmation || match.tmdbId === null) {
      pendingConfirmation += 1;
      rows.push({
        uuid: row.uuid,
        title: row.title,
        csv_status: row.status,
        matching: match,
        tmdb: null,
        episodes_reconstructed: null,
        final_category: null,
        category_reason: null,
        needs_confirmation: true,
        persisted: false,
        persistence_note: "Aguardando confirmação manual do usuário (matching ambíguo ou não encontrado).",
      });
      continue;
    }

    const tmdbId = match.tmdbId;
    const tmdbInfo = tmdbInfoById.get(tmdbId) ?? null;
    const episodes = episodesBySeriesUuid.get(row.uuid) ?? [];
    const reconstructed = reconstructEpisodes(episodes);

    const specialEpisodeKeys = new Set(
      episodes.filter((e) => e.special).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
    );
    const categoryResult = resolveCategory(
      row.status,
      reconstructed.mainWatched.length,
      reconstructed.mainTotalInFile,
      tmdbInfo?.ended ?? false,
      episodesById.get(tmdbId) ?? null,
      specialEpisodeKeys
    );

    let persisted = false;
    let persistenceNote: string | null = null;
    try {
      const { error: statusError } = await supabase.from("series_status").upsert(
        {
          user_id: user.id,
          series_id: tmdbId,
          status: categoryResult.category,
          total_watch_events:
            reconstructed.mainWatched.length + reconstructed.mainWatched.reduce((sum, e) => sum + e.rewatchCount, 0),
          updated_at: new Date().toISOString(),
          // TASK-041 — campos opcionais do export, só enviados quando o CSV realmente os tem. Ausentes = comportamento antigo intacto (banco usa o default).
          ...(row.status ? { tvtime_status: row.status } : {}),
          ...(row.createdAt ? { created_at: new Date(row.createdAt).toISOString() } : {}),
        },
        { onConflict: "user_id,series_id" }
      );
      if (statusError) throw statusError;

      const episodesToWrite = [
        ...reconstructed.mainWatched.map((e) => ({ ...e, isSpecial: false })),
        ...reconstructed.specialsWatchedInFile.map((e) => ({
          seasonNumber: e.seasonNumber,
          episodeNumber: e.episodeNumber,
          watchedAt: null as string | null,
          rewatchCount: 0,
          isSpecial: true,
        })),
      ];
      for (let start = 0; start < episodesToWrite.length; start += EPISODE_CHUNK_SIZE) {
        const chunk = episodesToWrite.slice(start, start + EPISODE_CHUNK_SIZE).map((e) => ({
          user_id: user.id,
          series_id: tmdbId,
          season_number: e.seasonNumber,
          episode_number: e.episodeNumber,
          watched_at: e.watchedAt ? new Date(e.watchedAt).toISOString() : new Date().toISOString(),
          is_special: e.isSpecial,
          rewatch_count: e.rewatchCount,
        }));
        const { error: episodeError } = await supabase
          .from("watched_episodes")
          .upsert(chunk, { onConflict: "user_id,series_id,season_number,episode_number" });
        if (episodeError) throw episodeError;
      }

      persisted = true;
      imported += 1;
    } catch (error) {
      persistenceNote = `Falha na gravação — série NÃO foi persistida: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`[tvtime-migration] ${persistenceNote}`, row.title);
    }

    rows.push({
      uuid: row.uuid,
      title: row.title,
      csv_status: row.status,
      matching: match,
      tmdb: tmdbInfo ? { title: tmdbInfo.title, ended: tmdbInfo.ended } : null,
      episodes_reconstructed: {
        main_watched: reconstructed.mainWatched.length,
        main_total_in_file: reconstructed.mainTotalInFile,
        specials_watched: reconstructed.specialsWatchedInFile.length,
        specials_pending_confirmation: reconstructed.specialsNotWatchedInFile.length,
        specials_pending_list: reconstructed.specialsNotWatchedInFile,
      },
      final_category: categoryResult.category,
      category_reason: categoryResult.reason,
      needs_confirmation: false,
      persisted,
      persistence_note: persisted ? null : persistenceNote,
    });
  }

  // --- Filmes — mesmo espírito: descarte → matching → categoria (trivial, is_watched) → persistência. ---
  const { kept: keptMovies, discarded: discardedMovies } = filterDiscardedMovies(movieRows);

  onProgress?.("Identificando filmes no TMDB…", 0, keptMovies.length);
  const movieMatches = await matchAllMoviesNewPipeline(keptMovies, (done, total) =>
    onProgress?.("Identificando filmes no TMDB…", done, total)
  );
  const movieMatchByUuid = new Map(movieMatches.map((m) => [m.seriesUuid, m]));

  const matchedMovieTmdbIds = movieMatches.filter((m) => m.tmdbId !== null).map((m) => m.tmdbId as number);
  const movieTitleById = new Map<number, string>();
  for (let start = 0; start < matchedMovieTmdbIds.length; start += 100) {
    const batch = matchedMovieTmdbIds.slice(start, start + 100);
    try {
      const response = await fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: batch, seriesIds: [] }),
      });
      if (response.ok) {
        const data = (await response.json()) as { movies: { id: number; title: string }[] };
        for (const m of data.movies) movieTitleById.set(m.id, m.title);
      }
    } catch (error) {
      console.error("[tvtime-migration] Falha ao buscar lote de resumos de filmes do TMDB", error);
    }
  }

  const movieRowsReport: MovieReportRow[] = [];
  let moviesImported = 0;
  let moviesPendingConfirmation = 0;

  for (let index = 0; index < keptMovies.length; index++) {
    const row = keptMovies[index];
    if (!row) continue;
    onProgress?.("Importando filmes…", index + 1, keptMovies.length);

    const match = movieMatchByUuid.get(row.uuid);
    if (!match) continue;

    if (match.needsConfirmation || match.tmdbId === null) {
      moviesPendingConfirmation += 1;
      movieRowsReport.push({
        uuid: row.uuid,
        title: row.title,
        csv_is_watched: row.isWatched,
        matching: match,
        tmdb: null,
        final_status: null,
        status_reason: null,
        needs_confirmation: true,
        persisted: false,
        persistence_note: "Aguardando confirmação manual do usuário (matching ambíguo ou não encontrado).",
      });
      continue;
    }

    const tmdbId = match.tmdbId;
    const categoryResult = resolveMovieCategory(row.isWatched);

    let persisted = false;
    let persistenceNote: string | null = null;
    try {
      const { error } = await supabase.from("movie_status").upsert(
        {
          user_id: user.id,
          movie_id: tmdbId,
          status: categoryResult.status,
          watched_at: row.watchedAt ? new Date(row.watchedAt).toISOString() : null,
          rewatch_count: row.rewatchCount,
          updated_at: new Date().toISOString(),
          // TASK-041 — mesmo espírito do lado de séries: só enviado quando o CSV realmente tem created_at.
          ...(row.createdAt ? { created_at: new Date(row.createdAt).toISOString() } : {}),
        },
        { onConflict: "user_id,movie_id" }
      );
      if (error) throw error;
      persisted = true;
      moviesImported += 1;
    } catch (error) {
      persistenceNote = `Falha na gravação — filme NÃO foi persistido: ${
        error instanceof Error ? error.message : String(error)
      }`;
      console.error(`[tvtime-migration] ${persistenceNote}`, row.title);
    }

    movieRowsReport.push({
      uuid: row.uuid,
      title: row.title,
      csv_is_watched: row.isWatched,
      matching: match,
      tmdb: { title: movieTitleById.get(tmdbId) ?? null },
      final_status: categoryResult.status,
      status_reason: categoryResult.reason,
      needs_confirmation: false,
      persisted,
      persistence_note: persisted ? null : persistenceNote,
    });
  }

  return {
    generated_at: new Date().toISOString(),
    total_series_in_file: seriesRows.length,
    imported,
    discarded,
    pending_confirmation: pendingConfirmation,
    rows,
    total_movies_in_file: movieRows.length,
    movies_imported: moviesImported,
    movies_discarded: discardedMovies,
    movies_pending_confirmation: moviesPendingConfirmation,
    movie_rows: movieRowsReport,
  };
}
