import type { MediaSearchResult } from "@seenlist/types";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";
import { rankCandidates } from "../../tvtime-import/tmdb/scoring";
import { normalizeTitle } from "../../tvtime-import/tmdb/titleNormalization";

export type SeriesMatchSource = "tvdb_id" | "imdb_id" | "name_search" | "not_found";

export interface SeriesMatchResult {
  seriesUuid: string;
  title: string;
  tmdbId: number | null;
  matchedVia: SeriesMatchSource;
}

const BATCH_SIZE = 10;

interface FindResult {
  tvdbId: string;
  source: "tvdb_id" | "imdb_id";
  seriesTmdbId: number | null;
}

async function findByExternalIdBatch(
  ids: { id: string; source: "tvdb_id" | "imdb_id" }[]
): Promise<Map<string, number>> {
  const found = new Map<string, number>();
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    try {
      const response = await fetch("/api/tvtime-out-import/find-by-external-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch }),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { results: FindResult[] };
      for (const result of data.results) {
        if (result.seriesTmdbId !== null) {
          found.set(`${result.source}:${result.tvdbId}`, result.seriesTmdbId);
        }
      }
    } catch (error) {
      console.error(
        "[tvtime-out-import] Falha ao consultar um lote de IDs externos — as demais séries não são afetadas.",
        error
      );
    }
  }
  return found;
}

async function searchSeriesByName(query: string): Promise<MediaSearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("search failed");
  const data = (await response.json()) as { results: MediaSearchResult[] };
  return data.results.filter((result) => result.mediaType === "series");
}

/**
 * TASK-027L — cascata pedida explicitamente: "1. TVDB ID. 2. IMDb
 * ID. 3. Apenas se ambos falharem, usar busca por nome." Nada de
 * pontuação/histórico decidindo por cima de um ID que já veio
 * confirmado pelo próprio TV Time — isso só entra quando os dois IDs
 * realmente não resolveram nada.
 */
export async function matchAllSeries(
  seriesRows: ParsedSeriesFileRow[],
  onProgress?: (done: number, total: number) => void
): Promise<SeriesMatchResult[]> {
  const results: SeriesMatchResult[] = new Array(seriesRows.length);

  const tvdbIds = seriesRows
    .filter((s) => s.tvdbId)
    .map((s) => ({ id: s.tvdbId as string, source: "tvdb_id" as const }));
  const tvdbMatches = await findByExternalIdBatch(tvdbIds);

  const remainingAfterTvdb: { row: ParsedSeriesFileRow; index: number }[] = [];
  seriesRows.forEach((row, index) => {
    const tmdbId = row.tvdbId ? tvdbMatches.get(`tvdb_id:${row.tvdbId}`) : undefined;
    if (tmdbId !== undefined) {
      results[index] = { seriesUuid: row.uuid, title: row.title, tmdbId, matchedVia: "tvdb_id" };
    } else {
      remainingAfterTvdb.push({ row, index });
    }
  });

  const imdbIds = remainingAfterTvdb
    .filter((r) => r.row.imdbId)
    .map((r) => ({ id: r.row.imdbId as string, source: "imdb_id" as const }));
  const imdbMatches = imdbIds.length > 0 ? await findByExternalIdBatch(imdbIds) : new Map<string, number>();

  const remainingAfterImdb: { row: ParsedSeriesFileRow; index: number }[] = [];
  for (const { row, index } of remainingAfterTvdb) {
    const tmdbId = row.imdbId ? imdbMatches.get(`imdb_id:${row.imdbId}`) : undefined;
    if (tmdbId !== undefined) {
      results[index] = { seriesUuid: row.uuid, title: row.title, tmdbId, matchedVia: "imdb_id" };
    } else {
      remainingAfterImdb.push({ row, index });
    }
  }

  let done = seriesRows.length - remainingAfterImdb.length;
  onProgress?.(done, seriesRows.length);

  for (const { row, index } of remainingAfterImdb) {
    try {
      const { normalizedTitle, extractedYear } = normalizeTitle(row.title);
      const searchResults = await searchSeriesByName(normalizedTitle);
      if (searchResults.length === 0) {
        results[index] = { seriesUuid: row.uuid, title: row.title, tmdbId: null, matchedVia: "not_found" };
      } else {
        const ranked = rankCandidates(
          normalizedTitle,
          extractedYear,
          searchResults.map((r) => ({
            tmdbId: r.id,
            title: r.title,
            originalTitle: r.originalTitle ?? null,
            year: r.year,
            popularity: r.popularity ?? 0,
          }))
        );
        const best = ranked[0];
        if (best) {
          results[index] = {
            seriesUuid: row.uuid,
            title: row.title,
            tmdbId: best.tmdbId,
            matchedVia: "name_search",
          };
        } else {
          results[index] = { seriesUuid: row.uuid, title: row.title, tmdbId: null, matchedVia: "not_found" };
        }
      }
    } catch (error) {
      console.error(`[tvtime-out-import] Falha ao buscar "${row.title}" por nome`, error);
      results[index] = { seriesUuid: row.uuid, title: row.title, tmdbId: null, matchedVia: "not_found" };
    }
    done += 1;
    onProgress?.(done, seriesRows.length);
  }

  return results;
}
