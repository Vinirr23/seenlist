import type { AuditReport } from "./types";

/** TASK-027C, item 3 — "Exportar Auditoria... JSON, Markdown". */
export function exportAuditAsJson(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportAuditAsMarkdown(report: AuditReport): string {
  const lines: string[] = [
    `# Auditoria de importação do TV Time`,
    ``,
    `Gerado em: ${report.generatedAt}`,
    ``,
    `## Resumo`,
    ``,
    `| Métrica | TV Time | SeenList |`,
    `|---|---|---|`,
    `| Séries | ${report.librarySeriesExpected} | ${report.librarySeriesImported} |`,
    `| Episódios | ${report.episodesExpected} | ${report.episodesImported} |`,
    `| Favoritos | ${report.favoritesExpected} | ${report.favoritesImported} |`,
    ``,
    `## Status reconstruído`,
    ``,
    `- Assistindo: ${report.watchingCount}`,
    `- Assistir depois: ${report.wantToWatchCount}`,
    `- Concluídas: ${report.completedCount}`,
    `- Pendentes de revisão: ${report.pendingReviewCount}`,
    `- Confiança média: ${report.averageConfidence}%`,
    `- Tempo total: ${report.elapsedSeconds}s`,
    ``,
  ];

  if (report.discrepancies.length > 0) {
    lines.push(
      `## Discrepâncias (${report.discrepancies.length})`,
      ``,
      `| Série | Esperado | Encontrado | Motivo provável |`,
      `|---|---|---|---|`
    );
    for (const d of report.discrepancies) {
      lines.push(`| ${d.series} | ${d.expectedValue} | ${d.foundValue} | ${d.likelyReason} |`);
    }
    lines.push("");
  } else {
    lines.push(`## Discrepâncias`, ``, `Nenhuma discrepância encontrada.`, ``);
  }

  lines.push(
    `## Detalhe por série`,
    ``,
    `| Série | Esperado | Importado | Status | Reconstrução | Confiança |`,
    `|---|---|---|---|---|---|`
  );
  for (const r of report.records) {
    lines.push(
      `| ${r.name} | ${r.expectedEpisodes} | ${r.importedEpisodes} | ${r.status ?? "—"} | ${r.reconstructionKind ?? "—"} | ${r.confidence ?? "—"} |`
    );
  }

  return lines.join("\n");
}

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadAuditJson(report: AuditReport) {
  downloadTextFile(exportAuditAsJson(report), `tvtime-import-audit-${Date.now()}.json`, "application/json");
}

export function downloadAuditMarkdown(report: AuditReport) {
  downloadTextFile(exportAuditAsMarkdown(report), `tvtime-import-audit-${Date.now()}.md`, "text/markdown");
}
