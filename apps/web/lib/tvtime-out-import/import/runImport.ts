import { createClient } from "@/lib/supabase/client";
import { describeSupabaseError } from "@/lib/supabase/describeError";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";
import type { ParsedEpisodeRow } from "../parser/episodesParser";
import type { ParsedMovieFileRow } from "../parser/moviesParser";
import type { SeriesMatchResult } from "../matching/matchSeries";
import type { MovieMatchResult } from "../matching/matchMovies";
import { resolveSeriesStatus, countSeriesEpisodes, type SeriesResolvedStatus } from "../mapping/resolveStatus";
import { validateSeriesStatus, type SeriesLiveTmdbData } from "../mapping/validateSeriesStatus";
import { StatusPipelineAuditCollector } from "../diagnostics-detail/statusPipelineAudit";

const EPISODE_UPSERT_CHUNK_SIZE = 500;

export interface TvTimeOutImportOptions {
  importSeries: boolean;
  importMovies: boolean;
}

export interface SeriesImportRecord {
  title: string;
  tmdbId: number | null;
  matchedVia: string;
  fileStatus: string;
  resolvedStatus: string | null;
  /** TASK-033 — motivo de qualquer correção automática da validação final. Null = status do arquivo preservado sem alteração. */
  validationReason: string | null;
  watchedNonSpecialCount: number;
  totalNonSpecialInFile: number;
  specialCount: number;
  episodesWritten: number;
}

export interface MovieImportRecord {
  title: string;
  tmdbId: number | null;
  matchedVia: string;
  status: string | null;
}

export interface TvTimeOutImportResult {
  seriesImported: number;
  seriesNotFound: number;
  episodesImported: number;
  moviesImported: number;
  moviesNotFound: number;
  seriesRecords: SeriesImportRecord[];
  movieRecords: MovieImportRecord[];
}

/**
 * TASK-027L — "abandonar a reconstrução baseada no GDPR... não
 * reconstruir episódios". Cada episódio com is_watched=true no
 * arquivo vira uma linha em watched_episodes, direto — nenhuma fatia
 * cronológica, nenhum min(), nenhuma "confiança". O arquivo JÁ diz
 * quais episódios específicos foram assistidos.
 *
 * Escopo desta primeira versão, declarado explicitamente: não
 * reimplementei a otimização de idempotência (TASK-027D/G) do
 * importador antigo — aqui toda série resolvida é reprocessada
 * (upsert idempotente por chave, mas sem "pular quando já
 * consistente"). Correto por construção; otimização de performance
 * fica pra depois que o pipeline novo estiver validado contra uma
 * importação real.
 */
export async function runTvTimeOutImport(
  seriesRows: ParsedSeriesFileRow[],
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>,
  seriesMatches: SeriesMatchResult[],
  movieRows: ParsedMovieFileRow[],
  movieMatches: MovieMatchResult[],
  options: TvTimeOutImportOptions,
  onProgress?: (current: { name: string; index: number; total: number }) => void,
  sourceFileName?: string,
  exportDate?: string | null
): Promise<TvTimeOutImportResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  // TASK-027N — "verificar se o importador realmente está usando
  // tvtime-series.csv". Registrado ANTES de qualquer processamento,
  // direto do que foi de fato parseado — não uma suposição.
  const statusAudit = new StatusPipelineAuditCollector();
  const distinctStatusCounts = new Map<string, number>();
  for (const row of seriesRows) {
    distinctStatusCounts.set(row.status, (distinctStatusCounts.get(row.status) ?? 0) + 1);
  }
  statusAudit.printFileInvestigation(sourceFileName ?? "(nome não informado)", distinctStatusCounts, seriesRows.length);

  const seriesRecords: SeriesImportRecord[] = [];
  let episodesImported = 0;
  const pendingStatusTraces: {
    title: string;
    tmdbId: number;
    fileStatus: string;
    afterResolve: SeriesResolvedStatus;
    afterValidate: string;
    validationReason: string | null;
    writtenToDb: string;
    watchedNonSpecialCount: number;
    totalNonSpecialInFile: number;
  }[] = [];

  if (options.importSeries) {
    const seriesByUuid = new Map(seriesRows.map((s) => [s.uuid, s]));

    // TASK-027R — busca dado AO VIVO do TMDB pra TODAS as séries
    // casadas, de uma vez, ANTES de decidir qualquer status final.
    // Duas buscas diferentes: "ended" continua vindo do resumo leve
    // (library-summaries); a lista de EPISÓDIOS COM AIR_DATE vem de
    // uma rota nova e mais pesada (series-episodes-at-export), em
    // lotes menores — é o dado que faltava pra comparar contra a
    // export_date em vez do total agregado.
    const matchedTmdbIds = seriesMatches.filter((m) => m.tmdbId !== null).map((m) => m.tmdbId as number);
    const endedBySeriesId = new Map<number, boolean>();
    const episodesBySeriesId = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>();

    if (matchedTmdbIds.length > 0) {
      try {
        const response = await fetch("/api/tmdb/library-summaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movieIds: [], seriesIds: matchedTmdbIds }),
        });
        if (response.ok) {
          const data = (await response.json()) as { series: { id: number; ended: boolean }[] };
          for (const s of data.series) {
            endedBySeriesId.set(s.id, s.ended);
          }
        }
      } catch (error) {
        console.error(
          "[tvtime-out-import] Falha ao buscar resumo do TMDB (ended) — validação de série encerrada fica sem efeito, mas a importação continua.",
          error
        );
      }

      const EPISODES_BATCH_SIZE = 20;
      for (let start = 0; start < matchedTmdbIds.length; start += EPISODES_BATCH_SIZE) {
        const batch = matchedTmdbIds.slice(start, start + EPISODES_BATCH_SIZE);
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
            for (const s of data.series) {
              episodesBySeriesId.set(s.id, s.episodes);
            }
          }
        } catch (error) {
          console.error(
            `[tvtime-out-import] Falha ao buscar episódios com air_date do lote ${start}-${start + EPISODES_BATCH_SIZE} — as demais séries continuam sendo processadas.`,
            error
          );
        }
      }
    }

    const liveTmdbBySeriesId = new Map<number, SeriesLiveTmdbData>();
    for (const id of matchedTmdbIds) {
      const episodes = episodesBySeriesId.get(id);
      if (episodes) {
        liveTmdbBySeriesId.set(id, { episodes, ended: endedBySeriesId.get(id) ?? false });
      }
    }

    for (let index = 0; index < seriesMatches.length; index++) {
      const match = seriesMatches[index];
      if (!match) continue;
      const row = seriesByUuid.get(match.seriesUuid);
      if (!row) continue;
      onProgress?.({ name: match.title, index: index + 1, total: seriesMatches.length });

      const episodes = episodesBySeriesUuid.get(match.seriesUuid) ?? [];
      const counts = countSeriesEpisodes(episodes);

      if (match.tmdbId === null) {
        seriesRecords.push({
          title: match.title,
          tmdbId: null,
          matchedVia: match.matchedVia,
          fileStatus: row.status,
          resolvedStatus: null,
          validationReason: null,
          ...counts,
          episodesWritten: 0,
        });
        continue;
      }

      const baseStatus = resolveSeriesStatus({
        fileStatus: row.status,
        watchedNonSpecialCount: counts.watchedNonSpecialCount,
        totalNonSpecialInFile: counts.totalNonSpecialInFile,
      });

      const specialEpisodeKeys = new Set(
        episodes.filter((e) => e.special).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
      );
      const { status, reason: validationReason } = validateSeriesStatus(
        baseStatus,
        counts.watchedNonSpecialCount,
        exportDate ?? null,
        liveTmdbBySeriesId.get(match.tmdbId) ?? null,
        specialEpisodeKeys
      );
      if (validationReason) {
        console.log(`[tvtime-out-import] "${match.title}" — validação final: ${validationReason}`);
      }

      pendingStatusTraces.push({
        title: match.title,
        tmdbId: match.tmdbId,
        fileStatus: row.status,
        afterResolve: baseStatus,
        afterValidate: status,
        validationReason,
        writtenToDb: status,
        watchedNonSpecialCount: counts.watchedNonSpecialCount,
        totalNonSpecialInFile: liveTmdbBySeriesId.get(match.tmdbId)?.episodes.length ?? counts.totalNonSpecialInFile,
      });

      const chronological = [...episodes]
        .filter((e) => !e.special)
        .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
      const nextEpisode = chronological.find((e) => !e.isWatched) ?? null;

      try {
        const { error: statusError } = await supabase.from("series_status").upsert(
          {
            user_id: user.id,
            series_id: match.tmdbId,
            status,
            next_season_number: nextEpisode?.seasonNumber ?? null,
            next_episode_number: nextEpisode?.episodeNumber ?? null,
            total_watch_events: counts.watchedNonSpecialCount + episodes.reduce((sum, e) => sum + e.rewatchCount, 0),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,series_id" }
        );
        if (statusError) throw statusError;

        const watchedEpisodes = episodes.filter((e) => e.isWatched);
        let writtenCount = 0;
        for (let chunkStart = 0; chunkStart < watchedEpisodes.length; chunkStart += EPISODE_UPSERT_CHUNK_SIZE) {
          const chunk = watchedEpisodes.slice(chunkStart, chunkStart + EPISODE_UPSERT_CHUNK_SIZE).map((e) => ({
            user_id: user.id,
            series_id: match.tmdbId,
            season_number: e.seasonNumber,
            episode_number: e.episodeNumber,
            watched_at: normalizeWatchedAt(e.watchedAt),
            is_special: e.special,
            rewatch_count: e.rewatchCount,
          }));
          const { error: episodeError } = await supabase
            .from("watched_episodes")
            .upsert(chunk, { onConflict: "user_id,series_id,season_number,episode_number" });
          if (episodeError) throw episodeError;
          writtenCount += chunk.length;
        }
        episodesImported += writtenCount;

        seriesRecords.push({
          title: match.title,
          tmdbId: match.tmdbId,
          matchedVia: match.matchedVia,
          fileStatus: row.status,
          resolvedStatus: status,
          validationReason,
          ...counts,
          episodesWritten: writtenCount,
        });
      } catch (error) {
        console.error(`[tvtime-out-import] Falha ao importar "${match.title}"`, describeSupabaseError(error));
        seriesRecords.push({
          title: match.title,
          tmdbId: match.tmdbId,
          matchedVia: match.matchedVia,
          fileStatus: row.status,
          resolvedStatus: null,
          validationReason: null,
          ...counts,
          episodesWritten: 0,
        });
      }
    }
  }

  const movieRecords: MovieImportRecord[] = [];

  if (options.importMovies) {
    const movieByUuid = new Map(movieRows.map((m) => [m.uuid, m]));

    for (let index = 0; index < movieMatches.length; index++) {
      const match = movieMatches[index];
      if (!match) continue;
      const row = movieByUuid.get(match.movieUuid);
      if (!row) continue;
      onProgress?.({ name: match.title, index: index + 1, total: movieMatches.length });

      if (match.tmdbId === null) {
        movieRecords.push({ title: match.title, tmdbId: null, matchedVia: match.matchedVia, status: null });
        continue;
      }

      const status = row.isWatched ? "watched" : "want_to_watch";

      try {
        const { error } = await supabase.from("movie_status").upsert(
          {
            user_id: user.id,
            movie_id: match.tmdbId,
            status,
            watched_at: row.watchedAt ? normalizeWatchedAt(row.watchedAt) : null,
            rewatch_count: row.rewatchCount,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,movie_id" }
        );
        if (error) throw error;
        movieRecords.push({ title: match.title, tmdbId: match.tmdbId, matchedVia: match.matchedVia, status });
      } catch (error) {
        console.error(`[tvtime-out-import] Falha ao importar filme "${match.title}"`, describeSupabaseError(error));
        movieRecords.push({ title: match.title, tmdbId: match.tmdbId, matchedVia: match.matchedVia, status: null });
      }
    }
  }

  // TASK-027N — releitura em lote (mesmo padrão da TASK-027K) pra
  // saber o que REALMENTE ficou no banco depois de toda a gravação,
  // e então chamar a função de verdade da Biblioteca pra cada série
  // — não presumir que bate com o banco.
  if (pendingStatusTraces.length > 0) {
    const tmdbIds = pendingStatusTraces.map((t) => t.tmdbId);
    const { data: readBackRows } = await supabase
      .from("series_status")
      .select("series_id, status")
      .eq("user_id", user.id)
      .in("series_id", tmdbIds);
    const readBackById = new Map((readBackRows ?? []).map((r) => [r.series_id as number, r.status as string]));

    for (const t of pendingStatusTraces) {
      const readBack = readBackById.get(t.tmdbId) ?? null;
      const displayedByLibrary =
        readBack !== null
          ? statusAudit.computeLibraryDisplay(t.tmdbId, readBack, t.watchedNonSpecialCount, t.totalNonSpecialInFile)
          : null;

      statusAudit.record({
        title: t.title,
        tmdbId: t.tmdbId,
        fileStatus: t.fileStatus,
        afterResolve: t.afterResolve,
        afterValidate: t.afterValidate,
        validationReason: t.validationReason,
        writtenToDb: t.writtenToDb,
        readBackFromDb: readBack,
        displayedByLibrary,
        watchedNonSpecialCount: t.watchedNonSpecialCount,
        totalNonSpecialInFile: t.totalNonSpecialInFile,
      });
    }
  }
  statusAudit.printChangedSeriesTable();
  statusAudit.printReport();
  statusAudit.downloadVerdictJson();

  return {
    seriesImported: seriesRecords.filter((r) => r.tmdbId !== null && r.resolvedStatus !== null).length,
    seriesNotFound: seriesRecords.filter((r) => r.tmdbId === null).length,
    episodesImported,
    moviesImported: movieRecords.filter((r) => r.tmdbId !== null && r.status !== null).length,
    moviesNotFound: movieRecords.filter((r) => r.tmdbId === null).length,
    seriesRecords,
    movieRecords,
  };
}

/**
 * O export real tem dois formatos de data misturados: ISO8601 com
 * "Z" (created_at) e "YYYY-MM-DD HH:MM:SS" sem timezone (watched_at
 * de episódio). `new Date(...)` do JS entende os dois, mas o segundo
 * formato é interpretado como horário LOCAL do navegador, não UTC —
 * aproximação aceitável (não é dado crítico), documentado aqui pra
 * não ser confundido com bug se os horários parecerem "deslocados".
 */
function normalizeWatchedAt(value: string | null): string {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}
