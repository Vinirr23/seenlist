import type { ParsedMovieFileRow } from "../tvtime-out-import/parser/moviesParser";
import type { MatchCandidate, MatchResult } from "./types";

const BATCH_SIZE = 10;

/**
 * TASK-035 (extensão) — mesma cascata de 5 níveis das séries, mas
 * aqui o nível 3 ("nome + ano de estreia") é implementável de
 * verdade: `tvtime-movies.csv` traz `year` em 987 de 993 linhas
 * reais (diferente de séries, onde essa informação não existe em
 * lugar nenhum do export).
 */
export async function matchAllMoviesNewPipeline(
  rows: ParsedMovieFileRow[],
  onProgress?: (done: number, total: number) => void
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  const withTvdb = rows.filter((r) => r.tvdbId);
  const tvdbFound = await findByExternalIdBatch(
    withTvdb.map((r) => ({ id: r.tvdbId as string, source: "tvdb_id" as const }))
  );

  const remainingAfterTvdb: ParsedMovieFileRow[] = [];
  for (const row of rows) {
    const tmdbId = row.tvdbId ? tvdbFound.get(`tvdb_id:${row.tvdbId}`) : undefined;
    if (tmdbId !== undefined) {
      results.push({ seriesUuid: row.uuid, tmdbId, tier: "tvdb_id", needsConfirmation: false, candidates: [] });
    } else {
      remainingAfterTvdb.push(row);
    }
  }

  const withImdb = remainingAfterTvdb.filter((r) => r.imdbId);
  const imdbFound =
    withImdb.length > 0
      ? await findByExternalIdBatch(withImdb.map((r) => ({ id: r.imdbId as string, source: "imdb_id" as const })))
      : new Map<string, number>();

  const remainingAfterImdb: ParsedMovieFileRow[] = [];
  for (const row of remainingAfterTvdb) {
    const tmdbId = row.imdbId ? imdbFound.get(`imdb_id:${row.imdbId}`) : undefined;
    if (tmdbId !== undefined) {
      results.push({ seriesUuid: row.uuid, tmdbId, tier: "imdb_id", needsConfirmation: false, candidates: [] });
    } else {
      remainingAfterImdb.push(row);
    }
  }

  let done = rows.length - remainingAfterImdb.length;
  onProgress?.(done, rows.length);

  for (const row of remainingAfterImdb) {
    const result = await matchByNameWithTieBreak(row);
    results.push(result);
    done += 1;
    onProgress?.(done, rows.length);
  }

  return results;
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
      const data = (await response.json()) as {
        results: { tvdbId: string; source: string; movieTmdbId: number | null }[];
      };
      for (const r of data.results) {
        if (r.movieTmdbId !== null) found.set(`${r.source}:${r.tvdbId}`, r.movieTmdbId);
      }
    } catch (error) {
      console.error("[tvtime-migration] Falha em lote de busca por ID externo (filmes)", error);
    }
  }
  return found;
}

async function matchByNameWithTieBreak(row: ParsedMovieFileRow): Promise<MatchResult> {
  let searchResults: { id: number; title: string; year: number | null }[] = [];
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(row.title)}`);
    if (response.ok) {
      const data = (await response.json()) as {
        results: { id: number; mediaType: string; title: string; year: number | null }[];
      };
      searchResults = data.results.filter((r) => r.mediaType === "movie");
    }
  } catch (error) {
    console.error(`[tvtime-migration] Falha na busca por nome de "${row.title}"`, error);
  }

  if (searchResults.length === 0) {
    return { seriesUuid: row.uuid, tmdbId: null, tier: "not_found", needsConfirmation: true, candidates: [] };
  }

  if (searchResults.length === 1) {
    const only = searchResults[0];
    if (only) {
      return {
        seriesUuid: row.uuid,
        tmdbId: only.id,
        tier: "name_only",
        needsConfirmation: false,
        candidates: [],
      };
    }
  }

  const candidates: MatchCandidate[] = searchResults
    .slice(0, 5)
    .map((r) => ({ tmdbId: r.id, title: r.title, year: r.year, numberOfSeasons: null, totalEpisodes: null }));

  if (row.year !== null) {
    const matchingYear = candidates.filter((c) => c.year === row.year);
    if (matchingYear.length === 1) {
      const only = matchingYear[0];
      if (only) {
        return {
          seriesUuid: row.uuid,
          tmdbId: only.tmdbId,
          tier: "name_year",
          needsConfirmation: false,
          candidates,
        };
      }
    }
  }

  return { seriesUuid: row.uuid, tmdbId: null, tier: "ambiguous", needsConfirmation: true, candidates };
}
