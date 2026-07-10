import { createClient } from "@/lib/supabase/client";
import { buildLibraryItemsFromRows } from "@/lib/queries/library-state";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";
import type { ParsedEpisodeRow } from "../parser/episodesParser";
import { resolveSeriesStatus, countSeriesEpisodes } from "../mapping/resolveStatus";
import { validateSeriesStatus, type SeriesLiveTmdbData } from "../mapping/validateSeriesStatus";

/**
 * TASK-027R — versão 100% somente leitura da TASK-027Q. Reproduz
 * toda a lógica de importação (matching, resolveSeriesStatus,
 * validateSeriesStatus) e monta o objeto que SERIA enviado ao
 * upsert — mas nunca chama `.upsert()`, `.insert()` nem `.update()`.
 * A "linha atual do banco" é lida exatamente como está, sem esta
 * ferramenta alterar nada antes.
 *
 * Uso (console do navegador, na tela do importador):
 *   await proveStatusDivergenceReadOnly(seriesRows, episodesBySeriesUuid, exportDate, [
 *     { title: "Reacher", tvdbId: "366924" },
 *     { title: "Under the Dome", tvdbId: "264492" },
 *     { title: "Hannibal", tvdbId: "259063" },
 *   ]);
 */
export async function proveStatusDivergenceReadOnly(
  seriesRows: ParsedSeriesFileRow[],
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>,
  exportDate: string | null,
  targets: { title: string; tvdbId: string }[]
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[prove-status-divergence] Sem sessão — não dá pra ler a linha existente.");
    return;
  }

  for (const target of targets) {
    console.log("=========================================");
    console.log(`INVESTIGAÇÃO SOMENTE LEITURA: ${target.title}`);
    console.log("=========================================");

    const row = seriesRows.find((r) => r.tvdbId === target.tvdbId);
    if (!row) {
      console.error(`  Não achei tvdb_id=${target.tvdbId} em tvtime-series.csv`);
      continue;
    }
    console.log("\n[1] CSV:");
    console.log(`  uuid: ${row.uuid} | tvdb_id: ${row.tvdbId} | status: ${row.status}`);

    console.log("\n[2] Matching (tvdb_id → tmdb_id):");
    let tmdbId: number | null = null;
    let matchedName: string | null = null;
    let matchedYear: number | null = null;
    try {
      const response = await fetch("/api/tvtime-out-import/find-by-external-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [{ id: row.tvdbId, source: "tvdb_id" }] }),
      });
      if (response.ok) {
        const data = (await response.json()) as {
          results: {
            tvdbId: string;
            seriesTmdbId: number | null;
            seriesName: string | null;
            seriesYear: number | null;
          }[];
        };
        const found = data.results[0];
        tmdbId = found?.seriesTmdbId ?? null;
        matchedName = found?.seriesName ?? null;
        matchedYear = found?.seriesYear ?? null;
      }
    } catch (error) {
      console.error("  Falha no matching:", error);
    }
    console.log(
      `  tvdb_id: ${row.tvdbId} → tmdb_id: ${tmdbId ?? "NÃO ENCONTRADO"} → nome: ${matchedName ?? "—"} → ano: ${matchedYear ?? "—"}`
    );
    if (
      matchedName &&
      matchedName.toLowerCase() !== target.title.toLowerCase() &&
      !matchedName.toLowerCase().includes(target.title.toLowerCase())
    ) {
      console.log(
        `  ⚠ NOME RETORNADO ("${matchedName}") NÃO CORRESPONDE ao título esperado ("${target.title}") — possível colisão de matching.`
      );
    }
    if (tmdbId === null) {
      console.error("  Sem tmdb_id — não dá pra seguir.");
      continue;
    }

    const episodes = episodesBySeriesUuid.get(row.uuid) ?? [];
    const counts = countSeriesEpisodes(episodes);

    const afterResolve = resolveSeriesStatus({
      fileStatus: row.status,
      watchedNonSpecialCount: counts.watchedNonSpecialCount,
      totalNonSpecialInFile: counts.totalNonSpecialInFile,
    });
    console.log("\n[3] resolveSeriesStatus:");
    console.log(`  "${row.status}" → "${afterResolve}"`);

    console.log("\n[4] validateSeriesStatus:");
    let liveTmdb: SeriesLiveTmdbData | null = null;
    try {
      const [summaryResponse, episodesResponse] = await Promise.all([
        fetch("/api/tmdb/library-summaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ movieIds: [], seriesIds: [tmdbId] }),
        }),
        fetch("/api/tmdb/series-episodes-at-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seriesIds: [tmdbId] }),
        }),
      ]);
      const ended = summaryResponse.ok
        ? ((await summaryResponse.json()) as { series: { id: number; ended: boolean }[] }).series.find(
            (s) => s.id === tmdbId
          )?.ended ?? false
        : false;
      const tmdbEpisodes = episodesResponse.ok
        ? (
            (await episodesResponse.json()) as {
              series: {
                id: number;
                episodes: { seasonNumber: number; episodeNumber: number; airDate: string | null }[];
              }[];
            }
          ).series.find((s) => s.id === tmdbId)?.episodes ?? []
        : [];
      liveTmdb = { episodes: tmdbEpisodes, ended };
    } catch (error) {
      console.error("  Falha ao buscar TMDB:", error);
    }

    const specialEpisodeKeys = new Set(
      episodes.filter((e) => e.special).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
    );
    const {
      status: afterValidate,
      reason: validationReason,
      totalEpisodesAtExport,
      hasNewerEpisode,
    } = validateSeriesStatus(afterResolve, counts.watchedNonSpecialCount, exportDate, liveTmdb, specialEpisodeKeys);

    console.log(
      `  ended=${liveTmdb?.ended ?? "?"} | totalEpisodesAtExport=${totalEpisodesAtExport} | hasNewerEpisode=${hasNewerEpisode} | watchedNonSpecialCount=${counts.watchedNonSpecialCount}`
    );
    console.log(`  "${afterResolve}" → "${afterValidate}"`);
    console.log(`  motivo: ${validationReason ?? "nenhum (sem alteração)"}`);

    const chronological = [...episodes]
      .filter((e) => !e.special)
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    const nextEpisode = chronological.find((e) => !e.isWatched) ?? null;

    const wouldBeWritten = {
      user_id: user.id,
      series_id: tmdbId,
      status: afterValidate,
      next_season_number: nextEpisode?.seasonNumber ?? null,
      next_episode_number: nextEpisode?.episodeNumber ?? null,
      total_watch_events: counts.watchedNonSpecialCount + episodes.reduce((sum, e) => sum + e.rewatchCount, 0),
    };
    console.log("\n[5/6] Objeto que SERIA enviado ao upsert (NÃO enviado — só montado):");
    console.log(wouldBeWritten);

    const { data: currentRow, error: readError } = await supabase
      .from("series_status")
      .select("*")
      .eq("user_id", user.id)
      .eq("series_id", tmdbId)
      .maybeSingle();
    if (readError) {
      console.error("  Falha ao ler a linha atual:", readError);
      continue;
    }
    console.log("\n[7] Linha ATUALMENTE existente no banco (sem nenhuma escrita prévia desta ferramenta):");
    console.log(currentRow ?? "(nenhuma linha existe pra essa série ainda)");

    if (currentRow && currentRow.status !== wouldBeWritten.status) {
      console.log("\n  ⚠ DIFERENÇA ENTRE O CALCULADO E O QUE ESTÁ NO BANCO:");
      console.log(`  O algoritmo calculou "${wouldBeWritten.status}"`);
      console.log(`  O banco contém "${currentRow.status}"`);
    } else if (currentRow) {
      console.log("\n  ✅ O calculado bate com o que já está gravado no banco.");
    } else {
      console.log("\n  (Sem linha existente pra comparar — série nunca foi importada antes, ou foi removida.)");
    }

    console.log("\n[8] buildLibraryItemsFromRows, usando a linha existente do banco (não o valor calculado):");
    let displayedByLibrary: string | null = null;
    if (currentRow) {
      const watchedEpisodeRowsForCount = Array.from({ length: counts.watchedNonSpecialCount }, () => ({
        series_id: tmdbId as number,
        watched_at: new Date().toISOString(),
      }));
      const libraryItems = buildLibraryItemsFromRows(
        [],
        [
          {
            series_id: tmdbId,
            status: currentRow.status as never,
            created_at: currentRow.created_at,
            updated_at: currentRow.updated_at,
            total_watch_events: currentRow.total_watch_events ?? null,
          },
        ],
        watchedEpisodeRowsForCount,
        {
          movies: {},
          series: {
            [tmdbId]: {
              id: tmdbId,
              title: matchedName ?? target.title,
              year: matchedYear,
              posterPath: null,
              totalEpisodes: liveTmdb?.episodes.length ?? 0,
              ended: liveTmdb?.ended ?? false,
              runtimeMinutes: 0,
            },
          },
        }
      );
      displayedByLibrary = libraryItems[0]?.status ?? null;
      console.log(`  status exibido: "${displayedByLibrary}"`);
    } else {
      console.log("  (sem linha existente — nada pra Biblioteca exibir)");
    }

    console.log("\n-----------------------------------------");
    console.log("CADEIA (somente leitura):");
    console.log(`  CSV: ${row.status}`);
    console.log("    ↓");
    console.log(`  Matching: tmdb_id=${tmdbId}`);
    console.log("    ↓");
    console.log(`  resolveSeriesStatus: ${afterResolve}`);
    console.log("    ↓");
    console.log(`  validateSeriesStatus: ${afterValidate}`);
    console.log("    ↓");
    console.log(`  Objeto que seria gravado: ${wouldBeWritten.status}`);
    console.log("    ↓");
    console.log(`  Linha atual do banco: ${currentRow?.status ?? "(não existe)"}`);
    console.log("    ↓");
    console.log(`  Biblioteca: ${displayedByLibrary ?? "(não aplicável)"}`);
    console.log("=========================================\n");
  }
}
