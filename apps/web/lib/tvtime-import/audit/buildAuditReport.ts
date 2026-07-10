import type { ParsedArchive } from "../mapping/types";
import type { AuditRecord, AuditDiscrepancy, AuditReport } from "./types";

/**
 * TASK-027C, item 4 — "nunca apenas 'importação falhou'". Cada
 * discrepância vem com série, valor esperado, valor encontrado e
 * motivo provável — nunca uma mensagem genérica.
 *
 * TASK-027J — "esperado" aqui significa episódios ÚNICOS
 * (record.expectedEpisodes), nunca o bruto do GDPR. Comparar contra
 * o bruto faria toda série reassistida aparecer como "discrepância",
 * quando na verdade está correta por design agora.
 */
function detectDiscrepancies(records: AuditRecord[]): AuditDiscrepancy[] {
  const discrepancies: AuditDiscrepancy[] = [];

  for (const record of records) {
    if (record.tmdbId === null) {
      discrepancies.push({
        series: record.name,
        expectedValue: `${record.expectedEpisodes} episódios únicos, na biblioteca`,
        foundValue: "não importada",
        likelyReason: "Série não foi identificada no TMDB (ambígua, não encontrada, ou pulada manualmente).",
      });
      continue;
    }

    if (record.expectedEpisodes !== record.importedEpisodes) {
      discrepancies.push({
        series: record.name,
        expectedValue: `${record.expectedEpisodes} episódios únicos`,
        foundValue: `${record.importedEpisodes} episódios gravados`,
        likelyReason:
          "Episódios únicos esperados (já limitados ao total do TMDB) não batem com o que foi gravado — isso é uma falha real de escrita agora, não mais uma reassistida (essa já está refletida em expectedEpisodes).",
      });
    }

    if (record.isFavorite && !record.favoriteImported) {
      discrepancies.push({
        series: record.name,
        expectedValue: "favoritada",
        foundValue: "não gravada como favorita",
        likelyReason: "Falha ao gravar na tabela de favoritos (ver log de erro desta série durante a importação).",
      });
    }
  }

  const totalExpectedEpisodes = records.reduce((sum, record) => sum + record.expectedEpisodes, 0);
  const totalImportedEpisodes = records.reduce((sum, record) => sum + record.importedEpisodes, 0);
  if (totalExpectedEpisodes !== totalImportedEpisodes) {
    discrepancies.push({
      series: "(total da importação)",
      expectedValue: `${totalExpectedEpisodes} episódios únicos esperados`,
      foundValue: `${totalImportedEpisodes} episódios únicos gravados`,
      likelyReason: "Diferença agregada — ver discrepâncias individuais acima pra saber exatamente em qual série.",
    });
  }

  return discrepancies;
}

export function buildAuditReport(parsed: ParsedArchive, records: AuditRecord[], elapsedSeconds: number): AuditReport {
  const librarySeriesImported = records.filter((r) => r.tmdbId !== null).length;
  const episodesImported = records.reduce((sum, r) => sum + r.importedEpisodes, 0);
  const favoritesImported = records.filter((r) => r.favoriteImported).length;
  const wantToWatchCount = records.filter((r) => r.status === "want_to_watch").length;
  const completedCount = records.filter((r) => r.status === "completed").length;
  const watchingCount = records.filter((r) => r.status === "watching").length;
  const pendingReviewCount = records.filter((r) => r.reconstructionKind === "needs_review").length;

  const confidences = records.filter((r) => r.confidence !== null).map((r) => r.confidence as number);
  const averageConfidence =
    confidences.length > 0 ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length : 0;

  return {
    generatedAt: new Date().toISOString(),
    librarySeriesExpected: parsed.shows.length,
    librarySeriesImported,
    episodesExpected: records.reduce((sum, r) => sum + r.expectedEpisodes, 0),
    episodesImported,
    watchEventsExpected: parsed.shows.reduce((sum, show) => sum + show.totalWatchEvents, 0),
    favoritesExpected: parsed.favoriteCount,
    favoritesImported,
    wantToWatchCount,
    completedCount,
    watchingCount,
    pendingReviewCount,
    averageConfidence: Math.round(averageConfidence * 10) / 10,
    elapsedSeconds,
    discrepancies: detectDiscrepancies(records),
    records,
  };
}
