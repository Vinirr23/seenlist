/**
 * TASK-027A, "melhoria obrigatória" — só ativo em desenvolvimento.
 * `process.env.NODE_ENV` é substituído em tempo de build pelo
 * Next.js mesmo no bundle do cliente, então essa checagem funciona
 * sem round-trip nenhum ao servidor.
 */
export const DIAGNOSTICS_ENABLED = process.env.NODE_ENV === "development";

export interface FileDiagnostic {
  file: string;
  rowCount: number;
}

export interface ImportDiagnosticsReport {
  filesFound: string[];
  filesMissing: string[];
  possibleFormatChange: boolean;
  perFile: FileDiagnostic[];
  showsFound: number;
  moviesFound: number;
  episodesFound: number;
  favoritesFound: number;
  showsAutoMatched: number;
  showsManuallyResolved: number;
  showsNotFound: number;
  episodesImported: number;
  /** TASK-027B — séries com progresso reconstruído que precisam de revisão manual (inconsistência entre nb_episodes_seen e o TMDB). Meta: menos de 2% do total de séries. */
  pendingReviewCount: number;
  elapsedMs: number;
}

/**
 * Acumula os números ao longo do fluxo (extração → parsing →
 * matching → importação) e imprime um relatório único e legível no
 * console ao final.
 */
export class ImportDiagnostics {
  private startedAt = Date.now();
  private perFile: FileDiagnostic[] = [];
  private filesFound: string[] = [];
  private filesMissing: string[] = [];
  private possibleFormatChange = false;

  recordArchive(allFileNames: string[], missingFiles: string[], possibleFormatChange: boolean) {
    this.filesFound = allFileNames;
    this.filesMissing = missingFiles;
    this.possibleFormatChange = possibleFormatChange;
  }

  recordFileParsed(file: string, rowCount: number) {
    this.perFile.push({ file, rowCount });
  }

  print(final: {
    showsFound: number;
    moviesFound: number;
    episodesFound: number;
    favoritesFound: number;
    showsAutoMatched: number;
    showsManuallyResolved: number;
    showsNotFound: number;
    episodesImported: number;
    pendingReviewCount: number;
  }) {
    if (!DIAGNOSTICS_ENABLED) return;

    const report: ImportDiagnosticsReport = {
      filesFound: this.filesFound,
      filesMissing: this.filesMissing,
      possibleFormatChange: this.possibleFormatChange,
      perFile: this.perFile,
      elapsedMs: Date.now() - this.startedAt,
      ...final,
    };

    console.group("%c[tvtime-import] Relatório de diagnóstico (dev)", "font-weight: bold; color: #E8A33D");
    console.log("Arquivos encontrados no zip:", report.filesFound);
    console.log("Arquivos conhecidos ausentes:", report.filesMissing);
    if (report.possibleFormatChange) {
      console.warn(
        "Nenhum arquivo conhecido foi reconhecido, mas o zip não está vazio — possível mudança de formato. Ver /docs/tvtime-gdpr-spec.md."
      );
    }
    console.table(
      report.perFile.map((f) => ({
        arquivo: f.file,
        linhas: f.rowCount,
      }))
    );
    console.log(
      `Séries encontradas: ${report.showsFound} (${report.showsAutoMatched} automáticas, ${report.showsManuallyResolved} resolvidas manualmente, ${report.showsNotFound} não encontradas)`
    );
    console.log(
      `Episódios (contagem agregada do GDPR): ${report.episodesFound} — episódios efetivamente reconstruídos e importados: ${report.episodesImported}`
    );
    console.log(`Favoritos encontrados: ${report.favoritesFound}`);

    const reviewPercentage = report.showsFound > 0 ? (report.pendingReviewCount / report.showsFound) * 100 : 0;
    const withinTarget = reviewPercentage < 2;
    console.log(
      `%cSéries pendentes de revisão (reconstrução inconsistente): ${report.pendingReviewCount} de ${report.showsFound} (${reviewPercentage.toFixed(1)}%) — meta: < 2% ${withinTarget ? "✅ dentro da meta" : "⚠️ ACIMA da meta"}`,
      withinTarget ? "color: #34C77B" : "color: #E8574A"
    );

    console.log(`Tempo total: ${(report.elapsedMs / 1000).toFixed(1)}s`);
    console.groupEnd();

    return report;
  }
}
