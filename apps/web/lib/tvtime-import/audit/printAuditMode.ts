import type { AuditReport } from "./types";

export const AUDIT_MODE_ENABLED = process.env.NODE_ENV === "development";

/**
 * TASK-027C, item 2 — "Modo Auditoria (Desenvolvimento)... esse
 * relatório não deve aparecer em produção". Formato próximo ao
 * exemplo da tarefa, mas usando os rótulos e números que este
 * importador realmente produz.
 */
export function printAuditMode(report: AuditReport): void {
  if (!AUDIT_MODE_ENABLED) return;

  const line = "=".repeat(30);
  const rows: [string, string | number][] = [
    ["Séries encontradas (TV Time)", report.librarySeriesExpected],
    ["Séries importadas", report.librarySeriesImported],
    ["", ""],
    ["Episódios (TV Time)", report.episodesExpected],
    ["Episódios (SeenList)", report.episodesImported],
    ["", ""],
    ["Favoritos (TV Time)", report.favoritesExpected],
    ["Importados", report.favoritesImported],
    ["", ""],
    ["Assistir depois", report.wantToWatchCount],
    ["Concluídas", report.completedCount],
    ["Assistindo", report.watchingCount],
    ["", ""],
    ["Pendências", report.pendingReviewCount],
    ["Confiança média", `${report.averageConfidence}%`],
    ["Tempo total", `${report.elapsedSeconds}s`],
  ];

  const text = [
    line,
    "TV TIME IMPORT AUDIT",
    line,
    ...rows.map(([label, value]) => (label ? `${label.padEnd(28, " ")} ${value}` : "")),
    line,
  ].join("\n");

  console.log(text);

  if (report.discrepancies.length > 0) {
    console.group(
      `%c⚠ ${report.discrepancies.length} discrepância(s) encontrada(s)`,
      "color: #F0B429; font-weight: bold"
    );
    console.table(report.discrepancies);
    console.groupEnd();
  } else {
    console.log("%c✅ Nenhuma discrepância encontrada.", "color: #34C77B");
  }
}
