import type { AuditReport } from "./types";

/**
 * TASK-027D, item 8 — formato pedido literalmente na tarefa. Diferente
 * do Modo Auditoria (printAuditMode.ts, só dev), este relatório
 * sempre aparece: é o resumo do que a importação fez, não uma
 * ferramenta de depuração interna.
 *
 * "0 duplicações": sempre 0 de propósito, não por coincidência —
 * `series_status`/`watched_episodes`/`favorites` têm chave primária
 * composta desde que existem, então duplicata é estruturalmente
 * impossível de acontecer no banco (ver audit/consistency.ts).
 */
export function printFinalReport(report: AuditReport, fixedInconsistencies: number): void {
  const line = "=".repeat(32);
  const lines = [
    line,
    "IMPORTAÇÃO CONCLUÍDA",
    "",
    `${report.librarySeriesImported} séries`,
    `${report.episodesImported} episódios`,
    `${report.favoritesImported} favoritos`,
    `${report.wantToWatchCount} assistir depois`,
    `${report.completedCount} concluídas`,
    "",
    "0 duplicações",
    `${fixedInconsistencies} inconsistência(s) corrigida(s) automaticamente`,
    "",
    `${report.averageConfidence}% confiança`,
    line,
  ];

  console.log(lines.join("\n"));
}
