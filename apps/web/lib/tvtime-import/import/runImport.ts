import { createClient } from "@/lib/supabase/client";
import type { ImportOptions, ImportSummary, ShowMatch } from "../mapping/types";
import { resolveStatus, type ResolvedStatus } from "../mapping/resolveStatus";
import { reconstructProgress, type SeasonSummary } from "../mapping/reconstructProgress";
import { isShowAlreadyConsistent } from "./idempotency";
import type { AuditRecord } from "../audit/types";
import { StatusDiagnosticsCollector, describeStatusDecision } from "../diagnostics-detail/statusDiagnostics";
import { ReconstructionAuditCollector, traceReconstruction } from "../diagnostics-detail/reconstructionAudit";
import { FullPipelineAuditCollector, type FullPipelineTrace } from "../diagnostics-detail/fullPipelineAudit";
import { saveReplaySnapshot } from "./replaySnapshot";

const SEASON_INFO_BATCH_SIZE = 10;
const EPISODE_UPSERT_CHUNK_SIZE = 500;

async function fetchSeasonSummaries(tmdbIds: number[]): Promise<Map<number, SeasonSummary>> {
  const result = new Map<number, SeasonSummary>();
  for (let start = 0; start < tmdbIds.length; start += SEASON_INFO_BATCH_SIZE) {
    const batch = tmdbIds.slice(start, start + SEASON_INFO_BATCH_SIZE);
    try {
      const response = await fetch("/api/tvtime-import/season-info", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seriesIds: batch }),
      });
      if (!response.ok) continue;
      const data = (await response.json()) as { results: Record<number, SeasonSummary> };
      for (const [id, summary] of Object.entries(data.results)) {
        result.set(Number(id), summary);
      }
    } catch (error) {
      console.error(
        "[tvtime-import] Falha ao buscar estrutura de temporadas de um lote — essas séries vão pra revisão",
        error
      );
    }
  }
  return result;
}

interface ExistingState {
  statusBySeriesId: Map<
    number,
    { status: string; nextSeason: number | null; nextEpisode: number | null; totalWatchEvents: number | null }
  >;
  episodeCountBySeriesId: Map<number, number>;
  favoriteSeriesIds: Set<number>;
}

/**
 * TASK-027D — busca TUDO que já existe no banco pro usuário ANTES de
 * decidir o que escrever. TASK-027J — `total_watch_events` entra na
 * consulta porque agora é ELE (não a contagem de watched_episodes)
 * que decide se uma série precisa ser reprocessada — ver
 * idempotency.ts.
 */
async function fetchExistingState(userId: string): Promise<ExistingState> {
  const supabase = createClient();
  const [statusResult, episodesResult, favoritesResult] = await Promise.all([
    supabase
      .from("series_status")
      .select("series_id, status, next_season_number, next_episode_number, total_watch_events")
      .eq("user_id", userId),
    supabase.from("watched_episodes").select("series_id").eq("user_id", userId),
    supabase.from("favorites").select("media_id").eq("user_id", userId).eq("media_type", "series"),
  ]);

  const statusBySeriesId = new Map(
    (statusResult.data ?? []).map((row) => [
      row.series_id as number,
      {
        status: row.status as string,
        nextSeason: row.next_season_number as number | null,
        nextEpisode: row.next_episode_number as number | null,
        totalWatchEvents: row.total_watch_events as number | null,
      },
    ])
  );

  const episodeCountBySeriesId = new Map<number, number>();
  for (const row of episodesResult.data ?? []) {
    const id = row.series_id as number;
    episodeCountBySeriesId.set(id, (episodeCountBySeriesId.get(id) ?? 0) + 1);
  }

  const favoriteSeriesIds = new Set((favoritesResult.data ?? []).map((row) => row.media_id as number));

  return { statusBySeriesId, episodeCountBySeriesId, favoriteSeriesIds };
}

export interface RunImportResult {
  summary: ImportSummary;
  auditRecords: AuditRecord[];
  /** TASK-027L — exposto pra alimentar o botão "Baixar diagnóstico da importação", sem precisar copiar o console nem exportar HAR. */
  fullPipelineTraces: FullPipelineTrace[];
}

/**
 * TASK-027 — grava em `series_status`/`watched_episodes` (não em
 * tabela nova). TASK-027J — separação definitiva de dois conceitos:
 *
 * - `watched_episodes` (episódios ÚNICOS) continua sendo a
 *   biblioteca — nunca reflete reassistida.
 * - `series_status.total_watch_events` (novo, TASK-027J) é o valor
 *   BRUTO do GDPR, usado só para estatísticas — nunca para decidir
 *   status/progresso.
 *
 * A reconstrução em si (`reconstructProgress.ts`) já faz
 * `uniqueEpisodesSeen = min(totalWatchEvents, totalKnownEpisodes)` —
 * este arquivo só usa esse valor já separado, nunca mistura os dois
 * de novo.
 */
export async function runImport(
  matches: ShowMatch[],
  options: ImportOptions,
  onProgress?: (current: { name: string; index: number; total: number }) => void
): Promise<RunImportResult> {
  const startedAt = Date.now();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not authenticated");

  const resolvable = matches.filter((match) => match.tmdbId !== null && match.status !== "skipped");

  if (options.mergeStrategy === "replace") {
    console.log("[tvtime-import] Estratégia 'substituir' — apagando biblioteca atual antes de importar");
    const { error: deleteEpisodesError } = await supabase.from("watched_episodes").delete().eq("user_id", user.id);
    if (deleteEpisodesError) throw deleteEpisodesError;
    const { error: deleteStatusError } = await supabase.from("series_status").delete().eq("user_id", user.id);
    if (deleteStatusError) throw deleteStatusError;
    const { error: deleteFavoritesError } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", user.id)
      .eq("media_type", "series");
    if (deleteFavoritesError) throw deleteFavoritesError;
  }

  const existing = await fetchExistingState(user.id);
  console.log(
    `[tvtime-import] Estado atual antes da importação: ${existing.statusBySeriesId.size} séries, ${[...existing.episodeCountBySeriesId.values()].reduce((a, b) => a + b, 0)} episódios únicos, ${existing.favoriteSeriesIds.size} favoritos`
  );

  const needsWork: typeof resolvable = [];
  const unchanged: typeof resolvable = [];
  let reprocessedDueToStatusInconsistency = 0;
  for (const match of resolvable) {
    const tmdbId = match.tmdbId as number;
    const existingStatusEntry = existing.statusBySeriesId.get(tmdbId);
    const existingForShow = {
      hasStatus: existing.statusBySeriesId.has(tmdbId),
      status: (existingStatusEntry?.status as ResolvedStatus | undefined) ?? null,
      nextSeason: existingStatusEntry?.nextSeason ?? null,
      nextEpisode: existingStatusEntry?.nextEpisode ?? null,
      totalWatchEvents: existingStatusEntry?.totalWatchEvents ?? null,
      isFavorite: existing.favoriteSeriesIds.has(tmdbId),
    };

    const consistent = isShowAlreadyConsistent(match.show, existingForShow);
    if (consistent) {
      unchanged.push(match);
    } else {
      needsWork.push(match);
      if (
        existingForShow.hasStatus &&
        existingForShow.totalWatchEvents === match.show.totalWatchEvents &&
        existingForShow.isFavorite === match.show.isFavorite
      ) {
        reprocessedDueToStatusInconsistency += 1;
      }
    }
  }

  console.log(
    `[tvtime-import] ${unchanged.length} séries realmente ignoradas (completed e consistentes), ${needsWork.length} reprocessadas — dessas, ${reprocessedDueToStatusInconsistency} só por causa de status não-completed pendente de reverificação`
  );

  const seasonSummaries = await fetchSeasonSummaries(needsWork.map((match) => match.tmdbId as number));

  // TASK-027K, "melhoria adicionada" — snapshot salvo aqui, depois do
  // parsing+matching+TMDB (as três etapas caras), antes de qualquer
  // escrita no banco. Ver replaySnapshot.ts pra reconstruir só a
  // parte de reconstrução+gravação sem repetir isso tudo.
  saveReplaySnapshot(matches, seasonSummaries);

  let importedShows = 0;
  const statusDiagnostics = new StatusDiagnosticsCollector();
  const reconstructionAudit = new ReconstructionAuditCollector();
  const fullPipelineAudit = new FullPipelineAuditCollector();
  const pendingPipelineTraces: {
    tmdbId: number;
    data: Omit<
      Parameters<typeof fullPipelineAudit.record>[0],
      "readBackStatus" | "readBackEpisodeCount" | "readBackFavorite"
    >;
  }[] = [];
  let importedEpisodes = 0;
  const auditRecords: AuditRecord[] = [];

  for (const match of matches.filter((m) => m.tmdbId === null || m.status === "skipped")) {
    auditRecords.push({
      name: match.show.name,
      tmdbId: null,
      expectedEpisodes: 0,
      importedEpisodes: 0,
      totalWatchEvents: match.show.totalWatchEvents,
      status: null,
      reconstructionKind: null,
      confidence: null,
      isFavorite: match.show.isFavorite,
      favoriteImported: false,
    });
  }

  for (const match of unchanged) {
    const tmdbId = match.tmdbId as number;
    const existingStatus = existing.statusBySeriesId.get(tmdbId);
    const uniqueCount = existing.episodeCountBySeriesId.get(tmdbId) ?? 0;
    auditRecords.push({
      name: match.show.name,
      tmdbId,
      expectedEpisodes: uniqueCount,
      importedEpisodes: uniqueCount,
      totalWatchEvents: match.show.totalWatchEvents,
      status: (existingStatus?.status as AuditRecord["status"]) ?? null,
      reconstructionKind: "deterministic",
      confidence: 100,
      isFavorite: match.show.isFavorite,
      favoriteImported: match.show.isFavorite,
    });

    // TASK-027K — nada foi reprocessado (idempotência), então o
    // estado atual do banco JÁ é tanto o "escrito" quanto o "lido de
    // volta" — não precisa de consulta nova pra saber isso.
    fullPipelineAudit.record({
      rawName: match.show.name,
      nbEpisodesSeen: match.show.totalWatchEvents,
      isExplicitlyForLater: match.show.isExplicitlyForLater,
      isFavoriteRaw: match.show.isFavorite,
      knownEpisodesCount: match.show.knownEpisodes.length,
      tmdbId,
      matchedTitle: match.matchedTitle ?? null,
      matchScore: match.matchScore ?? null,
      matchReason: match.matchReason ?? "equivalência salva (importação anterior)",
      tmdbNumberOfSeasons: null,
      tmdbTotalMainEpisodes: null,
      seasonsIgnored: null,
      uniqueEpisodesSeen: uniqueCount,
      totalWatchEvents: match.show.totalWatchEvents,
      confidence: 100,
      statusCalculated: (existingStatus?.status as AuditRecord["status"]) ?? null,
      statusRule: "série já consistente — pulada pela idempotência (TASK-027G/D), não reprocessada nesta importação",
      wasSkippedByIdempotency: true,
      writtenStatus: existingStatus?.status ?? null,
      writtenEpisodeCount: uniqueCount,
      writtenFavorite: match.show.isFavorite,
      readBackStatus: existingStatus?.status ?? null,
      readBackEpisodeCount: uniqueCount,
      readBackFavorite: match.show.isFavorite,
    });
  }

  for (let index = 0; index < needsWork.length; index++) {
    const match = needsWork[index];
    if (!match) continue;
    const tmdbId = match.tmdbId as number;
    onProgress?.({ name: match.show.name, index: index + 1, total: needsWork.length });

    let status = null as ResolvedStatus | null;
    let statusRuleApplied: string | null = null;
    let importedForThisShow = existing.episodeCountBySeriesId.get(tmdbId) ?? 0;
    let favoriteImported = existing.favoriteSeriesIds.has(tmdbId);

    try {
      const summary = seasonSummaries.get(tmdbId) ?? null;
      const totalKnownEpisodes = summary
        ? summary.seasons.filter((s) => s.seasonNumber >= 1).reduce((sum, s) => sum + s.episodeCount, 0)
        : null;

      const reconstruction = reconstructProgress(match.show, summary);
      if (reconstruction.needsReview) {
        console.warn(`[tvtime-import] "${match.show.name}" precisa de revisão: ${reconstruction.reviewReason}`);
      }

      if (options.importLibrary) {
        status = resolveStatus(
          reconstruction.uniqueEpisodesSeen,
          match.show.isExplicitlyForLater,
          totalKnownEpisodes
        );

        // TASK-027J — a validação redundante da TASK-027G foi removida
        // daqui: com uniqueEpisodesSeen já vindo limitado por min() em
        // reconstructProgress.ts, "uniqueEpisodesSeen >= total mas
        // status != completed" é estruturalmente impossível agora.
        // A checagem de sanidade continua existindo (ver
        // statusDiagnostics.ts/reconstructionAudit.ts), só que agora
        // ela deveria SEMPRE reportar zero.
        const statusDecision = describeStatusDecision(
          match.show.name,
          match.show.totalWatchEvents,
          reconstruction.uniqueEpisodesSeen,
          totalKnownEpisodes,
          match.show.isExplicitlyForLater,
          status
        );
        statusDiagnostics.record(statusDecision);
        statusRuleApplied = statusDecision.ruleApplied;

        const existingStatus = existing.statusBySeriesId.get(tmdbId);
        const statusChanged =
          !existingStatus ||
          existingStatus.status !== status ||
          existingStatus.nextSeason !== (reconstruction.nextEpisode?.seasonNumber ?? null) ||
          existingStatus.nextEpisode !== (reconstruction.nextEpisode?.episodeNumber ?? null) ||
          existingStatus.totalWatchEvents !== match.show.totalWatchEvents;

        if (statusChanged) {
          const { error } = await supabase.from("series_status").upsert(
            {
              user_id: user.id,
              series_id: tmdbId,
              status,
              next_season_number: reconstruction.nextEpisode?.seasonNumber ?? null,
              next_episode_number: reconstruction.nextEpisode?.episodeNumber ?? null,
              total_watch_events: match.show.totalWatchEvents,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,series_id" }
          );
          if (error) throw error;
        }
      }

      if (options.importEpisodes && options.restoreProgress && reconstruction.episodes.length > 0) {
        const rows = reconstruction.episodes.map((episode) => ({
          user_id: user.id,
          series_id: tmdbId,
          season_number: episode.seasonNumber,
          episode_number: episode.episodeNumber,
        }));

        for (let chunkStart = 0; chunkStart < rows.length; chunkStart += EPISODE_UPSERT_CHUNK_SIZE) {
          const chunk = rows.slice(chunkStart, chunkStart + EPISODE_UPSERT_CHUNK_SIZE);
          const { error } = await supabase
            .from("watched_episodes")
            .upsert(chunk, { onConflict: "user_id,series_id,season_number,episode_number", ignoreDuplicates: true });
          if (error) throw error;
        }
        importedForThisShow = reconstruction.episodes.length;
        importedEpisodes += reconstruction.episodes.length;
      }

      if (match.show.isFavorite && !favoriteImported) {
        const { error } = await supabase
          .from("favorites")
          .upsert(
            { user_id: user.id, media_type: "series", media_id: tmdbId },
            { onConflict: "user_id,media_type,media_id", ignoreDuplicates: true }
          );
        if (error) {
          console.error(`[tvtime-import] Falha ao gravar favorito de "${match.show.name}"`, error);
        } else {
          favoriteImported = true;
        }
      } else if (!match.show.isFavorite && favoriteImported) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .match({ user_id: user.id, media_type: "series", media_id: tmdbId });
        if (!error) favoriteImported = false;
      }

      importedShows += 1;

      reconstructionAudit.record(
        traceReconstruction({
          name: match.show.name,
          totalWatchEvents: match.show.totalWatchEvents,
          uniqueEpisodesSeen: reconstruction.uniqueEpisodesSeen,
          isExplicitlyForLater: match.show.isExplicitlyForLater,
          tmdbSeasonCount: summary?.numberOfSeasons ?? null,
          tmdbTotalMainEpisodes: totalKnownEpisodes,
          episodesMarked: importedForThisShow,
          statusCalculated: status,
        })
      );

      pendingPipelineTraces.push({
        tmdbId,
        data: {
          rawName: match.show.name,
          nbEpisodesSeen: match.show.totalWatchEvents,
          isExplicitlyForLater: match.show.isExplicitlyForLater,
          isFavoriteRaw: match.show.isFavorite,
          knownEpisodesCount: match.show.knownEpisodes.length,
          tmdbId,
          matchedTitle: match.matchedTitle ?? null,
          matchScore: match.matchScore ?? null,
          matchReason: match.matchReason ?? "desconhecido (não registrado no matching)",
          tmdbNumberOfSeasons: summary?.numberOfSeasons ?? null,
          tmdbTotalMainEpisodes: totalKnownEpisodes,
          seasonsIgnored: summary ? summary.seasons.filter((s) => s.seasonNumber < 1).length : null,
          uniqueEpisodesSeen: reconstruction.uniqueEpisodesSeen,
          totalWatchEvents: match.show.totalWatchEvents,
          confidence: reconstruction.confidence,
          statusCalculated: status,
          statusRule: statusRuleApplied,
          wasSkippedByIdempotency: false,
          writtenStatus: status,
          writtenEpisodeCount: importedForThisShow,
          writtenFavorite: favoriteImported,
        },
      });

      auditRecords.push({
        name: match.show.name,
        tmdbId,
        expectedEpisodes: reconstruction.uniqueEpisodesSeen,
        importedEpisodes: importedForThisShow,
        totalWatchEvents: match.show.totalWatchEvents,
        status,
        reconstructionKind: reconstruction.kind,
        confidence: reconstruction.confidence,
        isFavorite: match.show.isFavorite,
        favoriteImported,
      });
    } catch (error) {
      console.error(`[tvtime-import] Falha ao importar "${match.show.name}"`, error);
      auditRecords.push({
        name: match.show.name,
        tmdbId,
        expectedEpisodes: 0,
        importedEpisodes: importedForThisShow,
        totalWatchEvents: match.show.totalWatchEvents,
        status,
        reconstructionKind: null,
        confidence: null,
        isFavorite: match.show.isFavorite,
        favoriteImported,
      });
    }
  }

  importedShows += unchanged.length;
  importedEpisodes += unchanged.reduce(
    (sum, match) => sum + (existing.episodeCountBySeriesId.get(match.tmdbId as number) ?? 0),
    0
  );

  // TASK-027K, itens 7/8/9 — reconsulta o banco DEPOIS de toda a
  // gravação, pras mesmas séries que acabaram de ser escritas. Uma
  // consulta só (não uma por série) pra não pesar na performance.
  if (pendingPipelineTraces.length > 0) {
    const tmdbIds = pendingPipelineTraces.map((p) => p.tmdbId);
    const [statusReadBack, episodesReadBack, favoritesReadBack] = await Promise.all([
      supabase.from("series_status").select("series_id, status").eq("user_id", user.id).in("series_id", tmdbIds),
      supabase.from("watched_episodes").select("series_id").eq("user_id", user.id).in("series_id", tmdbIds),
      supabase
        .from("favorites")
        .select("media_id")
        .eq("user_id", user.id)
        .eq("media_type", "series")
        .in("media_id", tmdbIds),
    ]);

    const readBackStatusById = new Map((statusReadBack.data ?? []).map((r) => [r.series_id as number, r.status as string]));
    const readBackEpisodeCountById = new Map<number, number>();
    for (const row of episodesReadBack.data ?? []) {
      const id = row.series_id as number;
      readBackEpisodeCountById.set(id, (readBackEpisodeCountById.get(id) ?? 0) + 1);
    }
    const readBackFavoriteIds = new Set((favoritesReadBack.data ?? []).map((r) => r.media_id as number));

    for (const pending of pendingPipelineTraces) {
      fullPipelineAudit.record({
        ...pending.data,
        readBackStatus: readBackStatusById.get(pending.tmdbId) ?? null,
        readBackEpisodeCount: readBackEpisodeCountById.get(pending.tmdbId) ?? null,
        readBackFavorite: readBackFavoriteIds.has(pending.tmdbId),
      });
    }
  }
  fullPipelineAudit.printSamples();

  statusDiagnostics.print();
  reconstructionAudit.printFullTrace();
  reconstructionAudit.printErrorsOnly();
  reconstructionAudit.printAuditSample();

  console.log(
    [
      "=".repeat(32),
      "IDEMPOTÊNCIA (TASK-027G/J)",
      `Séries realmente ignoradas (já completed e consistentes): ${unchanged.length}`,
      `Séries reprocessadas por inconsistência de status pendente: ${reprocessedDueToStatusInconsistency}`,
      `Séries reprocessadas por outro motivo (watch events/favorito novo, ou nunca importadas): ${needsWork.length - reprocessedDueToStatusInconsistency}`,
      "=".repeat(32),
    ].join("\n")
  );

  const confidences = auditRecords.filter((r) => r.confidence !== null).map((r) => r.confidence as number);
  const summary: ImportSummary = {
    importedShows,
    skippedShows: matches.length - resolvable.length,
    notFoundShows: matches.filter((match) => match.status === "not_found").length,
    importedEpisodes,
    elapsedSeconds: Math.round((Date.now() - startedAt) / 1000),
    pendingReviewCount: auditRecords.filter((r) => r.reconstructionKind === "needs_review").length,
    completedShows: auditRecords.filter((r) => r.status === "completed").length,
    wantToWatchShows: auditRecords.filter((r) => r.status === "want_to_watch").length,
    watchingShows: auditRecords.filter((r) => r.status === "watching").length,
    favoritesImported: auditRecords.filter((r) => r.favoriteImported).length,
    averageConfidence:
      confidences.length > 0
        ? Math.round((confidences.reduce((sum, c) => sum + c, 0) / confidences.length) * 10) / 10
        : 0,
  };

  return { summary, auditRecords, fullPipelineTraces: fullPipelineAudit.getTraces() };
}
