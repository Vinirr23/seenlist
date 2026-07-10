import type { ParsedSeriesFileRow } from "../tvtime-out-import/parser/seriesParser";
import type { ParsedEpisodeRow } from "../tvtime-out-import/parser/episodesParser";
import type { MatchCandidate, MatchResult } from "./types";

const BATCH_SIZE = 10;

/**
 * TASK-035 — cascata nova, 5 níveis, na ordem obrigatória. Uma
 * observação honesta sobre o nível 3: o CSV da extensão TV Time Out
 * não traz "ano de estreia" da série em lugar nenhum (nem
 * tvtime-series.csv, nem tvtime-series-episodes.csv, que só tem
 * `watched_at` — quando o USUÁRIO assistiu, não quando o episódio
 * foi ao ar). Sem essa informação na fonte, não tem como comparar
 * "ano do arquivo" contra "ano do candidato" sem inventar um dado
 * que não existe — o que a tarefa proíbe ("não criar heurísticas").
 * Por isso a maioria dos casos aqui cai direto pro nível 4 (contagem
 * de episódios, que o arquivo de episódios permite calcular de
 * verdade) ou 5 (nome só, quando a busca já devolve 1 resultado).
 */
export async function matchAllSeriesNewPipeline(
  rows: ParsedSeriesFileRow[],
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>,
  onProgress?: (done: number, total: number) => void
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];

  const withTvdb = rows.filter((r) => r.tvdbId);
  const tvdbFound = await findByExternalIdBatch(
    withTvdb.map((r) => ({ id: r.tvdbId as string, source: "tvdb_id" as const }))
  );

  const remainingAfterTvdb: ParsedSeriesFileRow[] = [];
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

  const remainingAfterImdb: ParsedSeriesFileRow[] = [];
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
    const episodeCountInFile = (episodesBySeriesUuid.get(row.uuid) ?? []).filter((e) => !e.special).length;
    const result = await matchByNameWithTieBreak(row, episodeCountInFile);
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
        results: { tvdbId: string; source: string; seriesTmdbId: number | null }[];
      };
      for (const r of data.results) {
        if (r.seriesTmdbId !== null) found.set(`${r.source}:${r.tvdbId}`, r.seriesTmdbId);
      }
    } catch (error) {
      console.error("[tvtime-migration] Falha em lote de busca por ID externo", error);
    }
  }
  return found;
}

async function matchByNameWithTieBreak(row: ParsedSeriesFileRow, episodeCountInFile: number): Promise<MatchResult> {
  let searchResults: { id: number; title: string; year: number | null }[] = [];
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(row.title)}`);
    if (response.ok) {
      const data = (await response.json()) as {
        results: { id: number; mediaType: string; title: string; year: number | null }[];
      };
      searchResults = data.results.filter((r) => r.mediaType === "series");
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

  const candidates: MatchCandidate[] = [];
  try {
    const response = await fetch("/api/tvtime-import/season-info", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesIds: searchResults.slice(0, 5).map((r) => r.id) }),
    });
    if (response.ok) {
      const data = (await response.json()) as {
        results: Record<
          number,
          { numberOfSeasons: number; seasons: { seasonNumber: number; episodeCount: number }[] }
        >;
      };
      for (const r of searchResults.slice(0, 5)) {
        const summary = data.results[r.id];
        const totalEpisodes = summary
          ? summary.seasons.filter((s) => s.seasonNumber >= 1).reduce((sum, s) => sum + s.episodeCount, 0)
          : null;
        candidates.push({
          tmdbId: r.id,
          title: r.title,
          year: r.year,
          numberOfSeasons: summary?.numberOfSeasons ?? null,
          totalEpisodes,
        });
      }
    }
  } catch (error) {
    console.error(`[tvtime-migration] Falha ao buscar temporadas dos candidatos de "${row.title}"`, error);
  }

  if (candidates.length === 0) {
    return { seriesUuid: row.uuid, tmdbId: null, tier: "ambiguous", needsConfirmation: true, candidates: [] };
  }

  const matchingEpisodeCount = candidates.filter((c) => c.totalEpisodes === episodeCountInFile);
  if (matchingEpisodeCount.length === 1) {
    const only = matchingEpisodeCount[0];
    if (only) {
      return {
        seriesUuid: row.uuid,
        tmdbId: only.tmdbId,
        tier: "name_episode_count",
        needsConfirmation: false,
        candidates,
      };
    }
  }

  return { seriesUuid: row.uuid, tmdbId: null, tier: "ambiguous", needsConfirmation: true, candidates };
}
