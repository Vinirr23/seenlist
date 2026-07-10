import { createClient } from "@/lib/supabase/client";
import { fetchLibraryItems } from "@/lib/queries/library-state";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";
import type { ParsedEpisodeRow } from "../parser/episodesParser";
import { matchAllSeries } from "../matching/matchSeries";
import { resolveSeriesStatus, countSeriesEpisodes } from "../mapping/resolveStatus";
import { validateSeriesStatus, type SeriesLiveTmdbData } from "../mapping/validateSeriesStatus";

export interface FullAuditRow {
  csv: { uuid: string; tvdb_id: string; title: string; status: string };
  matching: { tvdb_id: string; tmdb_id: number | null; confidence: string };
  tmdb: { title: string | null; year: number | null; ended: boolean | null };
  database: { tmdb_id: number | null; title: string | null; status: string | null };
  library: { tmdb_id: number | null; title: string | null; status: string | null };
  identity_valid: boolean;
  status_valid: boolean;
  library_valid: boolean;
  failure_reason: string | null;
  status_proof: {
    csv_status: string;
    database_status: string | null;
    series_ended: boolean | null;
    episodes_at_export: number | null;
    episodes_current: number | null;
    watched_count: number;
    rule_applied: string | null;
  } | null;
}

export interface FullAuditReport {
  generated_at: string;
  summary: {
    total_series: number;
    csv_not_equal_database: number;
    database_not_equal_library: number;
    invalid_comparisons: number;
    invalid_status_changes: number;
    series_without_matching: number;
    series_without_poster: number;
    series_ignored: number;
  };
  rows: FullAuditRow[];
}

function titlesLooselyMatch(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\(\d{4}\)/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
  const na = normalize(a);
  const nb = normalize(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

async function fetchInBatches<T, R>(items: T[], batchSize: number, fetcher: (batch: T[]) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += batchSize) {
    const batch = items.slice(start, start + batchSize);
    results.push(await fetcher(batch));
  }
  return results;
}

/**
 * TASK-034 — ferramenta oficial única, acessível pela interface, sem
 * console. Reaproveita `matchAllSeries` de verdade (mesma função do
 * importador, sem reimplementar matching), `resolveSeriesStatus` e
 * `validateSeriesStatus` de verdade (as mesmas regras, sem alterar
 * nenhuma), e `fetchLibraryItems()` de verdade (a mesma função que a
 * tela usa). `statusesConceptuallyMatch` foi REMOVIDO — no lugar,
 * cada mudança de status só é aceita se RECALCULAR com dado fresco
 * (ended, episódios na exportação, episódios atuais) produzir
 * exatamente o mesmo valor que está gravado. "Teoricamente possível"
 * não é mais critério de validação.
 */
export async function runFullMigrationAudit(
  seriesRows: ParsedSeriesFileRow[],
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>,
  exportDate: string | null,
  onProgress?: (label: string, current: number, total: number) => void
): Promise<FullAuditReport> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  onProgress?.("Identificando séries no TMDB…", 0, seriesRows.length);
  const matches = await matchAllSeries(seriesRows, (done, total) =>
    onProgress?.("Identificando séries no TMDB…", done, total)
  );
  const matchByUuid = new Map(matches.map((m) => [m.seriesUuid, m]));

  const matchedTmdbIds = matches.filter((m) => m.tmdbId !== null).map((m) => m.tmdbId as number);

  onProgress?.("Buscando dados do TMDB…", 0, matchedTmdbIds.length);
  const tmdbInfoById = new Map<number, { title: string; year: number | null; ended: boolean }>();
  await fetchInBatches(matchedTmdbIds, 100, async (batch) => {
    try {
      const response = await fetch("/api/tmdb/library-summaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movieIds: [], seriesIds: batch }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          series: { id: number; title: string; year: number | null; ended: boolean }[];
        };
        for (const s of data.series) tmdbInfoById.set(s.id, { title: s.title, year: s.year, ended: s.ended });
      }
    } catch (error) {
      console.error("[full-audit] Falha ao buscar resumo do TMDB em lote", error);
    }
  });

  onProgress?.("Buscando episódios com data de exibição…", 0, matchedTmdbIds.length);
  const episodesById = new Map<number, { seasonNumber: number; episodeNumber: number; airDate: string | null }[]>();
  await fetchInBatches(matchedTmdbIds, 20, async (batch) => {
    try {
      const response = await fetch("/api/tmdb/series-episodes-at-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: batch }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          series: {
            id: number;
            episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[];
          }[];
        };
        for (const s of data.series) episodesById.set(s.id, s.episodes);
      }
    } catch (error) {
      console.error("[full-audit] Falha ao buscar episódios em lote", error);
    }
  });

  onProgress?.("Lendo o banco…", 0, 1);
  const { data: dbRows } = await supabase.from("series_status").select("series_id, status").eq("user_id", user.id);
  const dbStatusByTmdbId = new Map((dbRows ?? []).map((r) => [r.series_id as number, r.status as string]));

  onProgress?.("Consultando a Biblioteca…", 0, 1);
  const libraryItems = await fetchLibraryItems();
  const libraryByTmdbId = new Map(
    libraryItems.filter((i) => i.mediaType === "series").map((i) => [i.id, { title: i.title, status: i.status }])
  );

  const rows: FullAuditRow[] = [];
  let seriesWithoutMatching = 0;
  let seriesWithoutPoster = 0;
  let seriesIgnored = 0;

  for (const row of seriesRows) {
    const match = matchByUuid.get(row.uuid);
    const tmdbId = match?.tmdbId ?? null;
    const confidence = match?.matchedVia ?? "not_found";

    if (tmdbId === null) {
      seriesWithoutMatching += 1;
      rows.push({
        csv: { uuid: row.uuid, tvdb_id: row.tvdbId ?? "", title: row.title, status: row.status },
        matching: { tvdb_id: row.tvdbId ?? "", tmdb_id: null, confidence },
        tmdb: { title: null, year: null, ended: null },
        database: { tmdb_id: null, title: null, status: null },
        library: { tmdb_id: null, title: null, status: null },
        identity_valid: false,
        status_valid: false,
        library_valid: false,
        failure_reason: "Sem tmdb_id — matching não encontrou correspondência.",
        status_proof: null,
      });
      continue;
    }

    const tmdbInfo = tmdbInfoById.get(tmdbId) ?? null;
    if (!tmdbInfo) seriesWithoutPoster += 1;

    const identityValid = tmdbInfo ? titlesLooselyMatch(row.title, tmdbInfo.title) : false;
    let failureReason: string | null = null;
    if (!identityValid) {
      failureReason = tmdbInfo
        ? `CSV diz "${row.title}", mas tmdb_id ${tmdbId} corresponde a "${tmdbInfo.title}" no TMDB — provável colisão de matching.`
        : "Não foi possível confirmar o título real no TMDB pra este tmdb_id.";
    }

    const databaseStatus = dbStatusByTmdbId.get(tmdbId) ?? null;
    const libraryEntry = libraryByTmdbId.get(tmdbId) ?? null;

    const episodes = episodesBySeriesUuid.get(row.uuid) ?? [];
    const counts = countSeriesEpisodes(episodes);
    const baseStatus = resolveSeriesStatus({
      fileStatus: row.status,
      watchedNonSpecialCount: counts.watchedNonSpecialCount,
      totalNonSpecialInFile: counts.totalNonSpecialInFile,
    });

    const specialEpisodeKeys = new Set(
      episodes.filter((e) => e.special).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
    );
    const liveTmdb: SeriesLiveTmdbData | null = episodesById.has(tmdbId)
      ? { episodes: episodesById.get(tmdbId) as never, ended: tmdbInfo?.ended ?? false }
      : null;
    const validated = validateSeriesStatus(
      baseStatus,
      counts.watchedNonSpecialCount,
      exportDate,
      liveTmdb,
      specialEpisodeKeys
    );

    let statusValid = true;
    let statusProof: FullAuditRow["status_proof"] = null;
    if (databaseStatus !== null && databaseStatus !== baseStatus) {
      statusValid = databaseStatus === validated.status;
      statusProof = {
        csv_status: row.status,
        database_status: databaseStatus,
        series_ended: liveTmdb?.ended ?? null,
        episodes_at_export: validated.totalEpisodesAtExport,
        episodes_current: liveTmdb?.episodes.length ?? null,
        watched_count: counts.watchedNonSpecialCount,
        rule_applied: statusValid ? validated.reason : null,
      };
      if (!statusValid) {
        failureReason =
          failureReason ??
          `Banco tem "${databaseStatus}", mas recalculando agora com dado fresco o resultado correto seria "${validated.status}".`;
      }
    }

    const libraryValid = databaseStatus === null || libraryEntry === null || libraryEntry.status === databaseStatus;
    if (!libraryValid) {
      failureReason =
        failureReason ??
        `Banco tem "${databaseStatus}", mas fetchLibraryItems() devolveu "${libraryEntry?.status}" — divergência dentro de buildLibraryItemsFromRows/fetchLibraryItems.`;
    }

    if (!identityValid) seriesIgnored += 1;

    rows.push({
      csv: { uuid: row.uuid, tvdb_id: row.tvdbId ?? "", title: row.title, status: row.status },
      matching: { tvdb_id: row.tvdbId ?? "", tmdb_id: tmdbId, confidence },
      tmdb: { title: tmdbInfo?.title ?? null, year: tmdbInfo?.year ?? null, ended: tmdbInfo?.ended ?? null },
      database: { tmdb_id: tmdbId, title: tmdbInfo?.title ?? null, status: databaseStatus },
      library: { tmdb_id: tmdbId, title: libraryEntry?.title ?? null, status: libraryEntry?.status ?? null },
      identity_valid: identityValid,
      status_valid: statusValid,
      library_valid: libraryValid,
      failure_reason: failureReason,
      status_proof: statusProof,
    });
  }

  const validRows = rows.filter((r) => r.identity_valid);
  const csvNeDatabase = validRows.filter((r) => !r.status_valid).length;
  const databaseNeLibrary = validRows.filter((r) => !r.library_valid).length;
  const invalidComparisons = rows.filter((r) => !r.identity_valid).length;
  const invalidStatusChanges = validRows.filter((r) => r.status_proof !== null && !r.status_valid).length;

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_series: rows.length,
      csv_not_equal_database: csvNeDatabase,
      database_not_equal_library: databaseNeLibrary,
      invalid_comparisons: invalidComparisons,
      invalid_status_changes: invalidStatusChanges,
      series_without_matching: seriesWithoutMatching,
      series_without_poster: seriesWithoutPoster,
      series_ignored: seriesIgnored,
    },
    rows,
  };
}

export function downloadFullAuditReport(report: FullAuditReport): void {
  const json = JSON.stringify(report, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `migration-full-audit-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
