import { createClient } from "@/lib/supabase/client";
import { buildLibraryItemsFromRows } from "@/lib/queries/library-state";
import type { ParsedSeriesFileRow } from "../parser/seriesParser";
import type { ParsedEpisodeRow } from "../parser/episodesParser";
import { resolveSeriesStatus, countSeriesEpisodes } from "../mapping/resolveStatus";
import { validateSeriesStatus, type SeriesLiveTmdbData } from "../mapping/validateSeriesStatus";

/**
 * TASK-027Q — prova, etapa por etapa, onde o status de uma série
 * deixa de bater com o esperado. Inclui o MATCHING de verdade (tvdb
 * → tmdb, via a mesma rota que o importador usa), diferente da
 * versão anterior (debugSingleSeries.ts), que já recebia o tmdbId
 * pronto. Nenhuma regra de negócio é alterada aqui — só registrado.
 *
 * Uso (console do navegador, na tela do importador, com seriesRows/
 * episodesBySeriesUuid/exportDate já em memória):
 *   await proveStatusDivergence(seriesRows, episodesBySeriesUuid, exportDate, [
 *     { title: "Reacher", tvdbId: "366924" },
 *     { title: "Under the Dome", tvdbId: "264492" },
 *     { title: "Hannibal", tvdbId: "259063" },
 *   ]);
 */
export async function proveStatusDivergence(
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
    console.error("[prove-status-divergence] Sem sessão — não dá pra gravar/reler.");
    return;
  }

  for (const target of targets) {
    console.log("=========================================");
    console.log(`PROVA DE DIVERGÊNCIA: ${target.title}`);
    console.log("=========================================");

    const row = seriesRows.find((r) => r.tvdbId === target.tvdbId);
    if (!row) {
      console.error(`  Não achei tvdb_id=${target.tvdbId} em tvtime-series.csv`);
      continue;
    }
    console.log("\n[1] CSV — linha original:");
    console.log(`  uuid: ${row.uuid}`);
    console.log(`  tvdb_id: ${row.tvdbId}`);
    console.log(`  status: ${row.status}`);

    console.log("\n[2] Matching (tvdb_id → tmdb_id) — chamada real, mesma rota do importador:");
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
    console.log(`  tvdb_id: ${row.tvdbId}`);
    console.log(`  ↓`);
    console.log(`  tmdb_id encontrado: ${tmdbId ?? "NÃO ENCONTRADO"}`);
    console.log(`  ↓`);
    console.log(`  nome retornado: ${matchedName ?? "—"}`);
    console.log(`  ↓`);
    console.log(`  ano retornado: ${matchedYear ?? "—"}`);
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
      console.error("  Sem tmdb_id — não dá pra seguir pras próximas etapas.");
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
    console.log(`  entrada: "${row.status}"`);
    console.log(`  ↓`);
    console.log(`  saída: "${afterResolve}"`);

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

    console.log(`  status recebido: "${afterResolve}"`);
    console.log(`  ended = ${liveTmdb?.ended ?? "desconhecido"}`);
    console.log(`  totalEpisodesAtExport = ${totalEpisodesAtExport}`);
    console.log(`  hasNewerEpisode = ${hasNewerEpisode}`);
    console.log(`  watchedNonSpecialCount = ${counts.watchedNonSpecialCount}`);
    console.log(`  ↓`);
    console.log(`  status devolvido: "${afterValidate}"`);
    console.log(`  motivo: ${validationReason ?? "nenhum (sem alteração)"}`);
    console.log(
      `  condição que decidiu: ${
        validationReason
          ? afterValidate === "completed"
            ? `ended (${liveTmdb?.ended}) && fullyWatchedOverall && baseStatus !== "completed" → true`
            : `baseStatus === "up_to_date" (${afterResolve === "up_to_date"}) && hasNewerEpisode (${hasNewerEpisode}) → true`
          : "nenhuma condição retornou true — status preservado"
      }`
    );

    const chronological = [...episodes]
      .filter((e) => !e.special)
      .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episodeNumber - b.episodeNumber);
    const nextEpisode = chronological.find((e) => !e.isWatched) ?? null;

    const upsertPayload = {
      user_id: user.id,
      series_id: tmdbId,
      status: afterValidate,
      next_season_number: nextEpisode?.seasonNumber ?? null,
      next_episode_number: nextEpisode?.episodeNumber ?? null,
      total_watch_events: counts.watchedNonSpecialCount + episodes.reduce((sum, e) => sum + e.rewatchCount, 0),
      updated_at: new Date().toISOString(),
    };
    console.log("\n[5] Objeto enviado ao Supabase (upsert em series_status):");
    console.log(upsertPayload);

    const { error: writeError } = await supabase
      .from("series_status")
      .upsert(upsertPayload, { onConflict: "user_id,series_id" });
    if (writeError) {
      console.error("  Falha na gravação:", writeError);
      continue;
    }

    const { data: readBackRow, error: readError } = await supabase
      .from("series_status")
      .select("*")
      .eq("user_id", user.id)
      .eq("series_id", tmdbId)
      .maybeSingle();
    if (readError) {
      console.error("  Falha na releitura:", readError);
      continue;
    }
    console.log("\n[6] SELECT imediatamente após o upsert:");
    console.log(readBackRow);
    console.log(`  status salvo: "${readBackRow?.status}"`);

    const seriesStatusRowForLibrary = {
      series_id: tmdbId,
      status: (readBackRow?.status ?? null) as never,
      created_at: readBackRow?.created_at ?? new Date().toISOString(),
      updated_at: readBackRow?.updated_at ?? new Date().toISOString(),
      total_watch_events: readBackRow?.total_watch_events ?? null,
    };
    const watchedEpisodeRows = Array.from({ length: counts.watchedNonSpecialCount }, () => ({
      series_id: tmdbId,
      watched_at: new Date().toISOString(),
    }));
    console.log("\n[7] Objeto entregue a buildLibraryItemsFromRows (lib/queries/library-state.ts):");
    console.log("  series_status row:", seriesStatusRowForLibrary);
    console.log(`  media_id (= series_id): ${tmdbId}`);
    console.log(`  tmdb_id: ${tmdbId}`);

    const libraryItems = buildLibraryItemsFromRows([], [seriesStatusRowForLibrary], watchedEpisodeRows, {
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
    });
    const displayedByLibrary = libraryItems[0]?.status ?? null;
    console.log(`  status exibido: "${displayedByLibrary}"`);

    console.log("\n-----------------------------------------");
    console.log("CADEIA COMPLETA:");
    const chain: { label: string; value: string | null }[] = [
      { label: "CSV", value: row.status },
      { label: "resolveSeriesStatus", value: afterResolve },
      { label: "validateSeriesStatus", value: afterValidate },
      { label: "UPSERT", value: upsertPayload.status },
      { label: "SELECT", value: readBackRow?.status ?? null },
      { label: "Biblioteca", value: displayedByLibrary },
    ];

    let divergenceFound = false;
    for (let i = 0; i < chain.length; i++) {
      const current = chain[i];
      const previous = i > 0 ? chain[i - 1] : undefined;
      if (!current) continue;
      let marker = "";
      if (previous && !divergenceFound && current.value !== previous.value) {
        divergenceFound = true;
        marker = "  ← PRIMEIRA DIVERGÊNCIA";
      }
      console.log(`  ${current.label}: ${current.value}${marker}`);
      if (i < chain.length - 1) console.log("    ↓");
    }
if (!divergenceFound) {
      console.log(
        "  ✅ Nenhuma divergência — todas as etapas preservaram o mesmo valor (com as transformações esperadas de resolveSeriesStatus/validateSeriesStatus)."
      );
    }
    console.log("=========================================\n");
  }
}