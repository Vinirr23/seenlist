import { createClient } from "@/lib/supabase/client";
import { buildLibraryItemsFromRows } from "@/lib/queries/library-state";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";
import type { ParsedEpisodeRow } from "../parser/episodesParser";
import { resolveSeriesStatus, countSeriesEpisodes } from "../mapping/resolveStatus";
import { validateSeriesStatus, type SeriesLiveTmdbData } from "../mapping/validateSeriesStatus";

/**
 * TASK-027Q/R — depuração de UMA série só. Atualizado pra usar a
 * validação por export_date (TASK-027R) em vez do total agregado do
 * TMDB — mesma ferramenta, código real, sem simulação.
 *
 * Uso (console do navegador, na tela do importador):
 *   await debugSingleSeries(seriesRows, episodesBySeriesUuid, "The Walking Dead: Daryl Dixon", 427464, exportDate);
 */
export async function debugSingleSeries(
  seriesRows: ParsedSeriesFileRow[],
  episodesBySeriesUuid: Map<string, ParsedEpisodeRow[]>,
  seriesTitle: string,
  tmdbId: number,
  exportDate: string | null
): Promise<void> {
  const row = seriesRows.find((r) => r.title === seriesTitle);
  if (!row) {
    console.error(`[debug-single-series] Não achei "${seriesTitle}" em tvtime-series.csv`);
    return;
  }

  console.log("=========================================");
  console.log(`DEPURAÇÃO DE SÉRIE ÚNICA: ${seriesTitle}`);
  console.log("=========================================");

  console.log("\n[1] Linha original de tvtime-series.csv:");
  console.log(row);

  console.log("\n[2] Status lido do arquivo:");
  console.log(`  row.status = "${row.status}"`);
  console.log(`  export_date = ${exportDate ?? "(não encontrada — ver zip.ts)"}`);

  const episodes = episodesBySeriesUuid.get(row.uuid) ?? [];
  const counts = countSeriesEpisodes(episodes);
  console.log(`  watchedNonSpecialCount = ${counts.watchedNonSpecialCount}`);
  console.log(`  totalNonSpecialInFile  = ${counts.totalNonSpecialInFile}`);

  console.log("\n[3] resolveSeriesStatus — lib/tvtime-out-import/mapping/resolveStatus.ts");
  const afterResolve = resolveSeriesStatus({
    fileStatus: row.status,
    watchedNonSpecialCount: counts.watchedNonSpecialCount,
    totalNonSpecialInFile: counts.totalNonSpecialInFile,
  });
  console.log(`  Linha executada: case "${row.status}": return "${afterResolve}";`);
  console.log(`  Saída: "${afterResolve}" — sem condição de contagem nesta etapa.`);

  console.log("\n[4] Buscando episódios com air_date no TMDB pra esta série (só ela)...");
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
    console.error("[debug-single-series] Falha ao buscar TMDB", error);
  }
  console.log(`  liveTmdb.ended = ${liveTmdb?.ended}`);
  console.log(`  liveTmdb.episodes.length (total, todas as datas) = ${liveTmdb?.episodes.length ?? 0}`);

  console.log("\n[5] validateSeriesStatus — lib/tvtime-out-import/mapping/validateSeriesStatus.ts");
  const specialEpisodeKeys = new Set(
    episodes.filter((e) => e.special).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
  );
  const {
    status: afterValidate,
    reason,
    totalEpisodesAtExport,
    hasNewerEpisode,
  } = validateSeriesStatus(afterResolve, counts.watchedNonSpecialCount, exportDate, liveTmdb, specialEpisodeKeys);

  if (!liveTmdb || liveTmdb.episodes.length === 0 || !exportDate) {
    console.log(`  Linha 40: if (!liveTmdb || liveTmdb.episodes.length === 0 || !exportDate) → TRUE`);
    console.log(`  Linha 41: sem alteração — falta dado (TMDB ou export_date).`);
  } else {
    console.log(`  Linha 44-47: totalEpisodesAtExport (air_date <= ${exportDate}) = ${totalEpisodesAtExport}`);
    console.log(`  Linha 46-47: hasNewerEpisode (air_date > ${exportDate}) = ${hasNewerEpisode}`);
    console.log(
      `  Diagnóstico: watchedNonSpecialCount=${counts.watchedNonSpecialCount} vs totalEpisodesAtExport=${totalEpisodesAtExport} (informativo, não decide sozinho)`
    );

    const rule1 =
      liveTmdb.ended &&
      liveTmdb.episodes.length > 0 &&
      counts.watchedNonSpecialCount >= liveTmdb.episodes.length &&
      afterResolve !== "completed";
    console.log(
      `  Linha 55: if (ended (${liveTmdb.ended}) && fullyWatchedOverall (${counts.watchedNonSpecialCount >= liveTmdb.episodes.length}) && baseStatus !== "completed") → ${rule1}`
    );
    if (rule1) console.log(`  ❌ REGRA 1 APLICADA: status vira "completed".`);

    const rule2 = afterResolve === "up_to_date" && hasNewerEpisode;
    console.log(
      `  Linha 65: if (baseStatus === "up_to_date" (${afterResolve === "up_to_date"}) && hasNewerEpisode (${hasNewerEpisode})) → ${rule2}`
    );
    if (rule2 && !rule1) {
      console.log(`  ❌ REGRA 2 APLICADA: status vira "watching".`);
      console.log(`     Condição: existe episódio com air_date > ${exportDate}.`);
    }
    if (!rule1 && !rule2) {
      console.log(`  ✅ Nenhuma regra disparou — "${afterResolve}" preservado.`);
    }
  }
  console.log(`  Saída de validateSeriesStatus: "${afterValidate}" — motivo: ${reason ?? "nenhum (sem alteração)"}`);

  console.log("\n[6] Valor enviado ao Supabase (upsert em series_status):");
  console.log(`  status = "${afterValidate}"`);

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    console.error("[debug-single-series] Sem sessão — parando aqui.");
    return;
  }

  const chronological = [...episodes]
    .filter((e) => !e.special)
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
  const nextEpisode = chronological.find((e) => !e.isWatched) ?? null;

  const { error: writeError } = await supabase.from("series_status").upsert(
    {
      user_id: user.id,
      series_id: tmdbId,
      status: afterValidate,
      next_season_number: nextEpisode?.seasonNumber ?? null,
      next_episode_number: nextEpisode?.episodeNumber ?? null,
      total_watch_events: counts.watchedNonSpecialCount + episodes.reduce((sum, e) => sum + e.rewatchCount, 0),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,series_id" }
  );
  if (writeError) {
    console.error("[debug-single-series] Falha na gravação:", writeError);
    return;
  }

  console.log("\n[7/8] Releitura imediata do banco:");
  const { data: readBackRow, error: readError } = await supabase
    .from("series_status")
    .select("status")
    .eq("user_id", user.id)
    .eq("series_id", tmdbId)
    .maybeSingle();
  if (readError) {
    console.error("[debug-single-series] Falha na releitura:", readError);
    return;
  }
  const readBackStatus = readBackRow?.status ?? null;
  console.log(`  status relido = "${readBackStatus}"`);
  console.log(
    readBackStatus === afterValidate
      ? "  ✅ Gravação e releitura batem."
      : `  ❌ DIVERGÊNCIA: enviado "${afterValidate}", relido "${readBackStatus}".`
  );

  console.log("\n[9] Valor exibido pela Biblioteca — buildLibraryItemsFromRows, chamada real:");
  const libraryItems = buildLibraryItemsFromRows(
    [],
    [
      {
        series_id: tmdbId,
        status: readBackStatus as never,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        total_watch_events: null,
      },
    ],
    Array.from({ length: counts.watchedNonSpecialCount }, () => ({
      series_id: tmdbId,
      watched_at: new Date().toISOString(),
    })),
    {
      movies: {},
      series: {
        [tmdbId]: {
          id: tmdbId,
          title: seriesTitle,
          year: null,
          posterPath: null,
          totalEpisodes: liveTmdb?.episodes.length ?? 0,
          ended: liveTmdb?.ended ?? false,
          runtimeMinutes: 0,
        },
      },
    }
  );
  const displayedByLibrary = libraryItems[0]?.status ?? null;
  console.log(`  status exibido = "${displayedByLibrary}"`);
  console.log(
    displayedByLibrary === readBackStatus
      ? "  ✅ Biblioteca preserva o valor do banco."
      : `  ❌ DIVERGÊNCIA NA BIBLIOTECA: banco "${readBackStatus}", exibido "${displayedByLibrary}".`
  );

  console.log("\n=========================================");
  console.log("RESUMO DO RASTRO");
  console.log(`  Arquivo:              "${row.status}"`);
  console.log(`  resolveSeriesStatus:  "${afterResolve}"`);
  console.log(`  validateSeriesStatus: "${afterValidate}"${reason ? ` (${reason})` : ""}`);
  console.log(`  Banco (gravado):      "${afterValidate}"`);
  console.log(`  Banco (relido):       "${readBackStatus}"`);
  console.log(`  Biblioteca:           "${displayedByLibrary}"`);
  console.log("=========================================");
}
