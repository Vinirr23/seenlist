import type { MediaSearchResult } from "@seenlist/types";
import type { ParsedMovieFileRow } from "../parser/moviesParser";
import { rankCandidates } from "../../tvtime-import/tmdb/scoring";
import { normalizeTitle } from "../../tvtime-import/tmdb/titleNormalization";

export type MovieMatchSource = "tvdb_id" | "imdb_id" | "name_search" | "not_found";

export interface MovieMatchResult {
  movieUuid: string;
  title: string;
  tmdbId: number | null;
  matchedVia: MovieMatchSource;
}

const BATCH_SIZE = 10;

interface FindResult {
  tvdbId: string;
  source: "tvdb_id" | "imdb_id";
  movieTmdbId: number | null;
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
        if (result.movieTmdbId !== null) {
          found.set(`${result.source}:${result.tvdbId}`, result.movieTmdbId);
        }
      }
    } catch (error) {
      console.error(
        "[tvtime-out-import] Falha ao consultar um lote de IDs externos de filmes — os demais não são afetados.",
        error
      );
    }
  }
  return found;
}

async function searchMoviesByName(query: string): Promise<MediaSearchResult[]> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error("search failed");
  const data = (await response.json()) as { results: MediaSearchResult[] };
  return data.results.filter((result) => result.mediaType === "movie");
}

/** TASK-027L — mesma cascata de séries: TVDB → IMDb → nome, nessa ordem. */
export async function matchAllMovies(
  movieRows: ParsedMovieFileRow[],
  onProgress?: (done: number, total: number) => void
): Promise<MovieMatchResult[]> {
  const results: MovieMatchResult[] = new Array(movieRows.length);

  const tvdbIds = movieRows
    .filter((m) => m.tvdbId)
    .map((m) => ({ id: m.tvdbId as string, source: "tvdb_id" as const }));
  const tvdbMatches = await findByExternalIdBatch(tvdbIds);

  const remainingAfterTvdb: { row: ParsedMovieFileRow; index: number }[] = [];
  movieRows.forEach((row, index) => {
    const tmdbId = row.tvdbId ? tvdbMatches.get(`tvdb_id:${row.tvdbId}`) : undefined;
    if (tmdbId !== undefined) {
      results[index] = { movieUuid: row.uuid, title: row.title, tmdbId, matchedVia: "tvdb_id" };
    } else {
      remainingAfterTvdb.push({ row, index });
    }
  });

  const imdbIds = remainingAfterTvdb
    .filter((r) => r.row.imdbId)
    .map((r) => ({ id: r.row.imdbId as string, source: "imdb_id" as const }));
  const imdbMatches = imdbIds.length > 0 ? await findByExternalIdBatch(imdbIds) : new Map<string, number>();

  const remainingAfterImdb: { row: ParsedMovieFileRow; index: number }[] = [];
  for (const { row, index } of remainingAfterTvdb) {
    const tmdbId = row.imdbId ? imdbMatches.get(`imdb_id:${row.imdbId}`) : undefined;
    if (tmdbId !== undefined) {
      results[index] = { movieUuid: row.uuid, title: row.title, tmdbId, matchedVia: "imdb_id" };
    } else {
      remainingAfterImdb.push({ row, index });
    }
  }

  let done = movieRows.length - remainingAfterImdb.length;
  onProgress?.(done, movieRows.length);

  for (const { row, index } of remainingAfterImdb) {
    try {
      const { normalizedTitle, extractedYear } = normalizeTitle(row.title);
      const searchResults = await searchMoviesByName(normalizedTitle);
      if (searchResults.length === 0) {
        results[index] = { movieUuid: row.uuid, title: row.title, tmdbId: null, matchedVia: "not_found" };
      } else {
        const ranked = rankCandidates(
          normalizedTitle,
          extractedYear ?? row.year,
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
            movieUuid: row.uuid,
            title: row.title,
            tmdbId: best.tmdbId,
            matchedVia: "name_search",
          };
        } else {
          results[index] = { movieUuid: row.uuid, title: row.title, tmdbId: null, matchedVia: "not_found" };
        }
      }
    } catch (error) {
      console.error(`[tvtime-out-import] Falha ao buscar filme "${row.title}" por nome`, error);
      results[index] = { movieUuid: row.uuid, title: row.title, tmdbId: null, matchedVia: "not_found" };
    }
    done += 1;
    onProgress?.(done, movieRows.length);
  }

  return results;
}
