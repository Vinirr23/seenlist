import { buildLibraryItemsFromRows } from "@/lib/queries/library-state";
import type { SeriesResolvedStatus } from "../mapping/resolveStatus";

export type PipelineStatusStage =
  | "resolveSeriesStatus"
  | "validateSeriesStatus"
  | "gravação"
  | "leitura do banco"
  | "Biblioteca";

type DisplayCategory = "Assistindo" | "Em dia" | "Assistir depois" | "Interrompidas" | "Assistidas";

export interface SeriesStatusTrace {
  title: string;
  tmdbId: number;
  fileStatus: string;
  afterResolve: SeriesResolvedStatus;
  afterValidate: string;
  validationReason: string | null;
  writtenToDb: string;
  readBackFromDb: string | null;
  displayedByLibrary: string | null;
  watchedNonSpecialCount: number;
  totalNonSpecialInFile: number;
  firstDivergenceStage: PipelineStatusStage | null;
  /** TASK-027O, item 1 — explicação curta e legível, não só "onde", mas "por quê". */
  reason: string | null;
}

const STAGE_TO_FUNCTION: Record<PipelineStatusStage, string> = {
  resolveSeriesStatus: "lib/tvtime-out-import/mapping/resolveStatus.ts",
  validateSeriesStatus: "lib/tvtime-out-import/mapping/validateSeriesStatus.ts",
  gravação: "lib/tvtime-out-import/import/runImport.ts (upsert de series_status)",
  "leitura do banco": "Supabase/RLS em series_status (fora do código do importador)",
  Biblioteca: "lib/queries/library-state.ts (buildLibraryItemsFromRows)",
};

/**
 * TASK-027O — mesma detecção de sempre (cada etapa comparada contra
 * a anterior), agora também produzindo um MOTIVO legível, não só o
 * nome da etapa. Nenhuma regra de negócio nova — só nomeando, em
 * português, exatamente as duas correções que validateSeriesStatus.ts
 * já podia fazer (não inventei uma terceira).
 */
export function detectFirstStatusDivergence(
  trace: Omit<SeriesStatusTrace, "firstDivergenceStage" | "reason">
): { stage: PipelineStatusStage | null; reason: string | null } {
  if (trace.afterResolve !== trace.fileStatus && !isKnownRemap(trace.fileStatus, trace.afterResolve)) {
    return {
      stage: "resolveSeriesStatus",
      reason: `Mapeamento fora do esperado: "${trace.fileStatus}" → "${trace.afterResolve}".`,
    };
  }

  if (trace.afterValidate !== trace.afterResolve) {
    if (!trace.validationReason) {
      return {
        stage: "validateSeriesStatus",
        reason: `Mudou de "${trace.afterResolve}" para "${trace.afterValidate}" sem motivo registrado.`,
      };
    }
    // As duas ÚNICAS correções que validateSeriesStatus.ts pode fazer — nomeadas aqui pro relatório, a lógica em si não mudou.
    if (trace.afterValidate === "completed") {
      return { stage: "validateSeriesStatus", reason: "Série encerrada + todos os episódios assistidos" };
    }
    if (trace.afterResolve === "up_to_date" && trace.afterValidate === "watching") {
      return { stage: "validateSeriesStatus", reason: "Episódio lançado após a data da exportação" };
    }
    return { stage: "validateSeriesStatus", reason: trace.validationReason };
  }

  if (trace.writtenToDb !== trace.afterValidate) {
    return {
      stage: "gravação",
      reason: `Decidido "${trace.afterValidate}", mas gravado "${trace.writtenToDb}".`,
    };
  }

  if (trace.readBackFromDb !== null && trace.readBackFromDb !== trace.writtenToDb) {
    return {
      stage: "leitura do banco",
      reason: `Gravado "${trace.writtenToDb}", mas a releitura trouxe "${trace.readBackFromDb}".`,
    };
  }

  if (trace.displayedByLibrary !== null && trace.displayedByLibrary !== trace.readBackFromDb) {
    return { stage: "Biblioteca", reason: "Biblioteca alterou o status" };
  }

  return { stage: null, reason: null };
}

function isKnownRemap(fileStatus: string, resolved: string): boolean {
  const expected: Record<string, string> = {
    not_started_yet: "want_to_watch",
    watch_later: "want_to_watch",
    stopped: "paused",
    continuing: "watching",
    up_to_date: "up_to_date",
  };
  return expected[fileStatus] === resolved;
}

/**
 * TASK-027O, item 3 — categoria "do lado do TV Time". O arquivo não
 * tem um status explícito de "encerrada"/"Assistidas" — nenhum dos 5
 * valores confirmados significa isso. Critério adotado aqui, sem
 * inventar dado que o arquivo não tem: uso os PRÓPRIOS números do
 * arquivo (assistidos vs. total não-especial, do próprio CSV) pra
 * decidir se `up_to_date` conta como "Assistidas" ou "Em dia" do
 * ponto de vista do TV Time — mesmo critério que o resumo HTML da
 * própria extensão usa (campo `pct`).
 */
function tvTimeCategory(t: Pick<SeriesStatusTrace, "fileStatus" | "watchedNonSpecialCount" | "totalNonSpecialInFile">): DisplayCategory {
  switch (t.fileStatus) {
    case "not_started_yet":
    case "watch_later":
      return "Assistir depois";
    case "stopped":
      return "Interrompidas";
    case "continuing":
      return "Assistindo";
    case "up_to_date":
      return t.totalNonSpecialInFile > 0 && t.watchedNonSpecialCount >= t.totalNonSpecialInFile
        ? "Assistidas"
        : "Em dia";
    default:
      return "Assistir depois";
  }
}

function seenListCategory(status: string | null): DisplayCategory {
  switch (status) {
    case "watching":
      return "Assistindo";
    case "up_to_date":
      return "Em dia";
    case "want_to_watch":
      return "Assistir depois";
    case "paused":
      return "Interrompidas";
    case "completed":
      return "Assistidas";
    default:
      return "Assistindo";
  }
}

interface FromTo {
  from: string;
  to: string;
}

/**
 * TASK-027P — de onde pra onde olhar, depende de QUAL etapa
 * divergiu primeiro. Só validateSeriesStatus tem autorização pra
 * mudar status (as duas regras abaixo); qualquer divergência nas
 * OUTRAS etapas já é incorreta por definição — nada deveria mudar
 * ali, ponto.
 */
function fromToForStage(t: SeriesStatusTrace): FromTo {
  switch (t.firstDivergenceStage) {
    case "resolveSeriesStatus":
      return { from: t.fileStatus, to: t.afterResolve };
    case "validateSeriesStatus":
      return { from: t.afterResolve, to: t.afterValidate };
    case "gravação":
      return { from: t.afterValidate, to: t.writtenToDb };
    case "leitura do banco":
      return { from: t.writtenToDb, to: t.readBackFromDb ?? "???" };
    case "Biblioteca":
      return { from: t.readBackFromDb ?? "???", to: t.displayedByLibrary ?? "???" };
    default:
      return { from: t.fileStatus, to: t.fileStatus };
  }
}

/**
 * TASK-027P, item 2 — "o relatório deve conhecer as regras
 * oficiais". As únicas duas permitidas são exatamente as que
 * validateSeriesStatus.ts já é capaz de produzir (não é regra nova,
 * é a mesma regra, só formalizada aqui pra ser verificável). Toda
 * divergência fora de validateSeriesStatus já é incorreta — nenhuma
 * outra etapa tem autorização pra mudar status.
 */
function isAllowedChange(t: SeriesStatusTrace): boolean {
  if (t.firstDivergenceStage !== "validateSeriesStatus") return false;
  if (!t.reason) return false;

  if (t.afterValidate === "completed" && t.reason === "Série encerrada + todos os episódios assistidos") return true;
  if (t.afterResolve === "up_to_date" && t.afterValidate === "watching" && t.reason === "Episódio lançado após a data da exportação") {
    return true;
  }
  return false;
}

export interface VerdictGroup {
  from: string;
  to: string;
  count: number;
  reason: string;
  stage: string;
}

export interface MigrationVerdict {
  passed: boolean;
  totalSeries: number;
  unchanged: number;
  correctChanges: number;
  incorrectChanges: number;
  accuracy: number;
  mainRootCause: string | null;
  groups: VerdictGroup[];
  smallestFix: {
    function: string;
    ruleViolated: string;
    seriesFixed: number;
  } | null;
}


export class StatusPipelineAuditCollector {
  private traces: SeriesStatusTrace[] = [];

  record(partial: Omit<SeriesStatusTrace, "firstDivergenceStage" | "reason">) {
    const { stage, reason } = detectFirstStatusDivergence(partial);
    this.traces.push({ ...partial, firstDivergenceStage: stage, reason });
  }

  computeLibraryDisplay(
    seriesId: number,
    dbStatus: string,
    watchedEpisodeCount: number,
    totalEpisodes: number
  ): string {
    const items = buildLibraryItemsFromRows(
      [],
      [
        {
          series_id: seriesId,
          status: dbStatus as never,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          total_watch_events: null,
        },
      ],
      Array.from({ length: watchedEpisodeCount }, () => ({
        series_id: seriesId,
        watched_at: new Date().toISOString(),
      })),
      {
        movies: {},
        series: {
          [seriesId]: {
            id: seriesId,
            title: "",
            year: null,
            posterPath: null,
            totalEpisodes,
            ended: false,
            runtimeMinutes: 0,
          },
        },
      }
    );
    return items[0]?.status ?? "???";
  }

  printFileInvestigation(fileName: string, distinctStatusCounts: Map<string, number>, totalSeries: number) {
    console.group("%c[TASK-027N] Verificação do arquivo de origem", "font-weight: bold; color: #4A90D9");
    console.log(`Arquivo: ${fileName}`);
    console.log(`Séries encontradas: ${totalSeries}`);
    console.log("Valores distintos na coluna status:");
    console.table(
      [...distinctStatusCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, quantidade: count }))
    );
    console.groupEnd();
  }

  printReport() {
    this.printExecutiveSummary();
    this.printCategoryComparison();
    this.printGroupedDivergences();
    this.printRootCause();
    this.printVerdict();
  }

  /** TASK-027P, item 1 — coluna "Resultado" por série alterada, exemplo real da tarefa. */
  printChangedSeriesTable() {
    const changed = this.traces.filter((t) => t.firstDivergenceStage !== null);
    console.group("%c[TASK-027P] Séries alteradas — veredito por linha", "font-weight: bold; color: #4A90D9");
    console.table(
      changed.map((t) => ({
        série: t.title,
        arquivo: t.fileStatus,
        resolve: t.afterResolve,
        validate: t.afterValidate,
        banco: t.readBackFromDb ?? t.writtenToDb,
        biblioteca: t.displayedByLibrary ?? "—",
        motivo: t.reason ?? "Nenhum",
        resultado: isAllowedChange(t) ? "✅ Alteração esperada" : "❌ Alteração incorreta",
      }))
    );
    console.groupEnd();
  }

  private buildGroups(items: SeriesStatusTrace[]): VerdictGroup[] {
    const groups = new Map<string, VerdictGroup>();
    for (const t of items) {
      const { from, to } = fromToForStage(t);
      const key = `${from}→${to}→${t.reason}→${t.firstDivergenceStage}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {
          from,
          to,
          count: 1,
          reason: t.reason ?? "Nenhum",
          stage: t.firstDivergenceStage as string,
        });
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
  }

  private printVerdict() {
    const total = this.traces.length;
    const changed = this.traces.filter((t) => t.firstDivergenceStage !== null);
    const incorrect = changed.filter((t) => !isAllowedChange(t));
    const correct = changed.filter((t) => isAllowedChange(t));
    const unchanged = total - changed.length;
    const accuracy = total > 0 ? ((total - incorrect.length) / total) * 100 : 100;

    console.log("=========================");
    console.log("VEREDITO DA IMPORTAÇÃO");
    console.log("=========================");
    console.log(`Total de séries: ${total}`);
    console.log(`Sem alterações: ${unchanged}`);
    console.log(`Alterações corretas: ${correct.length}`);
    console.log(`Alterações incorretas: ${incorrect.length}`);
    console.log(`Taxa de acerto: ${accuracy.toFixed(2)}%`);
    console.log("");

    if (incorrect.length > 0) {
      const errorGroups = this.buildGroups(incorrect);
      console.group("%cALTERAÇÕES INCORRETAS", "font-weight: bold; color: #E8574A");
      for (const g of errorGroups) {
        const pct = ((g.count / incorrect.length) * 100).toFixed(0);
        console.log(
          [
            `${g.count} séries`,
            g.from,
            "  ↓",
            g.to,
            `Motivo registrado:`,
            `  ${g.reason}`,
            `Função responsável:`,
            `  ${STAGE_TO_FUNCTION[g.stage as PipelineStatusStage] ?? g.stage}`,
            `Representa ${pct}% dos erros encontrados.`,
            "-------------------------",
          ].join("\n")
        );
      }
      console.groupEnd();
    } else {
      console.log("Nenhuma alteração incorreta encontrada.");
    }
  }

  /**
   * TASK-027P, "melhoria adicionada" — menor correção necessária:
   * aponta o grupo dominante de erro (não uma correção ampla), pra
   * qualquer ajuste futuro atacar exatamente a causa dominante.
   */
  private buildSmallestFix(incorrect: SeriesStatusTrace[]): MigrationVerdict["smallestFix"] {
    if (incorrect.length === 0) return null;
    const groups = this.buildGroups(incorrect);
    const dominant = groups[0];
    if (!dominant) return null;
    const stage = dominant.stage as PipelineStatusStage;
    return {
      function: STAGE_TO_FUNCTION[stage] ?? stage,
      ruleViolated: `"${dominant.from}" não deveria virar "${dominant.to}" sem uma das duas justificativas permitidas (série encerrada + tudo assistido, ou episódio novo após a exportação).`,
      seriesFixed: dominant.count,
    };
  }

  buildVerdictJson(): MigrationVerdict {
    const total = this.traces.length;
    const changed = this.traces.filter((t) => t.firstDivergenceStage !== null);
    const incorrect = changed.filter((t) => !isAllowedChange(t));
    const correct = changed.filter((t) => isAllowedChange(t));
    const unchanged = total - changed.length;
    const accuracy = total > 0 ? Number((((total - incorrect.length) / total) * 100).toFixed(2)) : 100;

    const errorGroups = this.buildGroups(incorrect);
    const mainRootCause = errorGroups.length > 0 ? (errorGroups[0]?.stage ?? null) : null;

    return {
      passed: incorrect.length === 0,
      totalSeries: total,
      unchanged,
      correctChanges: correct.length,
      incorrectChanges: incorrect.length,
      accuracy,
      mainRootCause,
      groups: errorGroups,
      smallestFix: this.buildSmallestFix(incorrect),
    };
  }

  /** TASK-027P, item 5 — "ao término da importação, gerar automaticamente migration-verdict.json". */
  downloadVerdictJson(): void {
    const verdict = this.buildVerdictJson();
    const json = JSON.stringify(verdict, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "migration-verdict.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  private printExecutiveSummary() {
    const total = this.traces.length;
    const withDivergence = this.traces.filter((t) => t.firstDivergenceStage !== null);
    const byStage = new Map<PipelineStatusStage, number>();
    for (const t of withDivergence) {
      const stage = t.firstDivergenceStage as PipelineStatusStage;
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
    }

    const stages: PipelineStatusStage[] = [
      "resolveSeriesStatus",
      "validateSeriesStatus",
      "gravação",
      "leitura do banco",
      "Biblioteca",
    ];

    console.log("===== RESUMO =====");
    console.log(`Total de séries: ${total}`);
    console.log(`Sem divergência: ${total - withDivergence.length}`);
    console.log(`Com divergência: ${withDivergence.length}`);
    console.log("");
    console.log("Primeira divergência encontrada:");
    for (const stage of stages) {
      console.log(`  ${stage.padEnd(24, ".")} ${byStage.get(stage) ?? 0}`);
    }
    console.log("===================");
  }

  private printCategoryComparison() {
    const categories: DisplayCategory[] = ["Assistindo", "Em dia", "Assistir depois", "Interrompidas", "Assistidas"];
    const tvTimeCounts = new Map<DisplayCategory, number>();
    const seenListCounts = new Map<DisplayCategory, number>();

    for (const t of this.traces) {
      const tv = tvTimeCategory(t);
      const sl = seenListCategory(t.displayedByLibrary ?? t.readBackFromDb ?? t.writtenToDb);
      tvTimeCounts.set(tv, (tvTimeCounts.get(tv) ?? 0) + 1);
      seenListCounts.set(sl, (seenListCounts.get(sl) ?? 0) + 1);
    }

    console.group("%c[TASK-027O] Comparação TV Time × SeenList", "font-weight: bold; color: #4A90D9");
    console.log("TV TIME");
    for (const c of categories) console.log(`  ${c.padEnd(20, ".")} ${tvTimeCounts.get(c) ?? 0}`);
    console.log("");
    console.log("SEENLIST");
    for (const c of categories) console.log(`  ${c.padEnd(20, ".")} ${seenListCounts.get(c) ?? 0}`);
    console.log("");
    console.log("Diferenças");
    for (const c of categories) {
      const diff = (seenListCounts.get(c) ?? 0) - (tvTimeCounts.get(c) ?? 0);
      const sign = diff > 0 ? "+" : "";
      console.log(`  ${c.padEnd(20, ".")} ${sign}${diff}`);
    }
    console.groupEnd();
  }

  private printGroupedDivergences() {
    const withDivergence = this.traces.filter((t) => t.firstDivergenceStage !== null);

    const groups = new Map<string, { fileStatus: string; stage: string; result: string; reason: string; items: SeriesStatusTrace[] }>();
    for (const t of withDivergence) {
      const result = t.displayedByLibrary ?? t.readBackFromDb ?? t.writtenToDb;
      const key = `${t.fileStatus}→${t.firstDivergenceStage}→${result}→${t.reason}`;
      const group = groups.get(key) ?? {
        fileStatus: t.fileStatus,
        stage: t.firstDivergenceStage as string,
        result,
        reason: t.reason ?? "",
        items: [],
      };
      group.items.push(t);
      groups.set(key, group);
    }

    const sortedGroups = [...groups.values()].sort((a, b) => b.items.length - a.items.length);

    console.group("%c[TASK-027O] Divergências agrupadas por causa", "font-weight: bold; color: #E8574A");
    for (const g of sortedGroups) {
      console.log(
        [
          `${g.items.length} séries`,
          `Arquivo: ${g.fileStatus}`,
          `  ↓`,
          `${g.stage}`,
          `  ↓`,
          `${g.result}`,
          `Motivo: "${g.reason}"`,
          `Exemplos: ${g.items.slice(0, 3).map((i) => i.title).join(", ")}`,
          "-------------------------",
        ].join("\n")
      );
    }
    console.groupEnd();
  }

  private printRootCause() {
    const withDivergence = this.traces.filter((t) => t.firstDivergenceStage !== null);
    if (withDivergence.length === 0) {
      console.log("CAUSA RAIZ\nNenhuma divergência encontrada — todas as séries preservaram o status do arquivo em todas as etapas.");
      return;
    }

    const byStage = new Map<PipelineStatusStage, number>();
    for (const t of withDivergence) {
      const stage = t.firstDivergenceStage as PipelineStatusStage;
      byStage.set(stage, (byStage.get(stage) ?? 0) + 1);
    }

    const sortedStages = [...byStage.entries()].sort((a, b) => b[1] - a[1]);
    const dominant = sortedStages[0];
    if (!dominant) return;
    const [dominantStage, dominantCount] = dominant;
    const percentage = ((dominantCount / withDivergence.length) * 100).toFixed(0);

    console.log(
      [
        "CAUSA RAIZ",
        dominantStage,
        `${dominantCount} séries`,
        `Representa ${percentage}% de todas as divergências encontradas.`,
        `Função a corrigir: ${STAGE_TO_FUNCTION[dominantStage]}`,
      ].join("\n")
    );
  }

  getTraces() {
    return this.traces;
  }
}
