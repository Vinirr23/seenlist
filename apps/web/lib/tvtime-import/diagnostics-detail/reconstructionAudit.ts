import type { ResolvedStatus } from "../mapping/resolveStatus";

export interface ReconstructionTrace {
  name: string;
  /** TASK-027J — valor bruto do GDPR (nb_episodes_seen), incluindo reassistidas. Só contexto agora — não decide mais nada sozinho. */
  totalWatchEvents: number;
  /** min(totalWatchEvents, tmdbTotalMainEpisodes) — o valor que de fato decide status/episódios marcados. */
  uniqueEpisodesSeen: number;
  tmdbSeasonCount: number | null;
  tmdbTotalMainEpisodes: number | null;
  /** Quantos episódios a reconstrução realmente decidiu gravar — deveria ser sempre igual a uniqueEpisodesSeen (ver sanityMismatch). */
  episodesMarked: number;
  statusCalculated: ResolvedStatus | null;
  /** Recalculado aqui, de forma independente, só pra conferência — é a MESMA regra de resolveStatus.ts. */
  statusExpected: ResolvedStatus;
  ruleApplied: string;
  /**
   * TASK-027J — antes ("erro de reconstrução") sinalizava
   * uniqueEpisodesSeen >= total mas status != completed. Com o min()
   * em reconstructProgress.ts isso é estruturalmente impossível agora
   * — mantido só como checagem de sanidade (deveria ser sempre false).
   */
  isReconstructionError: boolean;
  /** episodesMarked deveria SEMPRE ser igual a uniqueEpisodesSeen agora — diferente disso é bug de verdade, não mais "reassistida", que já é esperada e não aparece aqui. */
  sanityMismatch: { expected: number; actual: number } | null;
}

function computeExpectedStatus(
  uniqueEpisodesSeen: number,
  isExplicitlyForLater: boolean,
  tmdbTotalMainEpisodes: number | null
): ResolvedStatus {
  if (isExplicitlyForLater || uniqueEpisodesSeen === 0) return "want_to_watch";
  if (tmdbTotalMainEpisodes !== null && tmdbTotalMainEpisodes > 0 && uniqueEpisodesSeen >= tmdbTotalMainEpisodes) {
    return "completed";
  }
  return "watching";
}

function describeRule(
  isExplicitlyForLater: boolean,
  uniqueEpisodesSeen: number,
  tmdbTotalMainEpisodes: number | null
): string {
  if (isExplicitlyForLater) return 'isExplicitlyForLater=true (user_show_special_status.csv, status="for_later")';
  if (uniqueEpisodesSeen === 0) return "uniqueEpisodesSeen === 0";
  if (tmdbTotalMainEpisodes === null) {
    return 'totalKnownEpisodes === null (TMDB não retornou dado pra essa série nesta importação) → cai no fallback "watching"';
  }
  if (tmdbTotalMainEpisodes === 0) {
    return 'totalKnownEpisodes === 0 (TMDB retornou 0 episódios principais) → cai no fallback "watching"';
  }
  if (uniqueEpisodesSeen >= tmdbTotalMainEpisodes) return "uniqueEpisodesSeen >= totalKnownEpisodes";
  return 'nenhuma das condições acima → fallback "watching"';
}

export function traceReconstruction(params: {
  name: string;
  totalWatchEvents: number;
  uniqueEpisodesSeen: number;
  isExplicitlyForLater: boolean;
  tmdbSeasonCount: number | null;
  tmdbTotalMainEpisodes: number | null;
  episodesMarked: number;
  statusCalculated: ResolvedStatus | null;
}): ReconstructionTrace {
  const {
    name,
    totalWatchEvents,
    uniqueEpisodesSeen,
    isExplicitlyForLater,
    tmdbSeasonCount,
    tmdbTotalMainEpisodes,
    episodesMarked,
    statusCalculated,
  } = params;

  const statusExpected = computeExpectedStatus(uniqueEpisodesSeen, isExplicitlyForLater, tmdbTotalMainEpisodes);
  const ruleApplied = describeRule(isExplicitlyForLater, uniqueEpisodesSeen, tmdbTotalMainEpisodes);

  const isReconstructionError =
    tmdbTotalMainEpisodes !== null &&
    tmdbTotalMainEpisodes > 0 &&
    uniqueEpisodesSeen >= tmdbTotalMainEpisodes &&
    statusCalculated !== "completed";

  const sanityMismatch =
    episodesMarked !== uniqueEpisodesSeen ? { expected: uniqueEpisodesSeen, actual: episodesMarked } : null;

  return {
    name,
    totalWatchEvents,
    uniqueEpisodesSeen,
    tmdbSeasonCount,
    tmdbTotalMainEpisodes,
    episodesMarked,
    statusCalculated,
    statusExpected,
    ruleApplied,
    isReconstructionError,
    sanityMismatch,
  };
}

export class ReconstructionAuditCollector {
  private traces: ReconstructionTrace[] = [];

  record(trace: ReconstructionTrace) {
    this.traces.push(trace);
  }

  printFullTrace() {
    for (const t of this.traces) {
      console.log(
        [
          "=".repeat(36),
          "",
          "TV Time",
          `Nome: ${t.name}`,
          `nb_episodes_seen (bruto, watch events): ${t.totalWatchEvents}`,
          `Episódios únicos (min com o TMDB): ${t.uniqueEpisodesSeen}`,
          "",
          "TMDB",
          `Temporadas: ${t.tmdbSeasonCount ?? "desconhecido (falha na busca)"}`,
          `Total de episódios principais: ${t.tmdbTotalMainEpisodes ?? "desconhecido (falha na busca)"}`,
          "",
          `Episódios marcados após reconstrução: ${t.episodesMarked}`,
          "",
          `Status calculado: ${t.statusCalculated ?? "—"}`,
          `Status esperado: ${t.statusExpected}`,
          "",
          `Regra utilizada: ${t.ruleApplied}`,
          t.isReconstructionError
            ? "⚠ deveria ser impossível após TASK-027J — uniqueEpisodesSeen >= total do TMDB, mas status final não é completed."
            : "",
          t.sanityMismatch
            ? `⚠ INCONSISTÊNCIA REAL: episódios marcados (${t.sanityMismatch.actual}) ≠ episódios únicos esperados (${t.sanityMismatch.expected}) — isso é bug de verdade agora, não reassistida (essa já está refletida em uniqueEpisodesSeen).`
            : "",
          "=".repeat(36),
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  printErrorsOnly() {
    const errors = this.traces.filter((t) => t.isReconstructionError);
    const mismatches = this.traces.filter((t) => t.sanityMismatch !== null);

    console.group("%c[TASK-027F/J] Resumo de erros de reconstrução", "font-weight: bold; color: #E8574A");
    console.log(`Total de séries analisadas: ${this.traces.length}`);
    console.log(`Erros de reconstrução (deveria ser sempre 0 após TASK-027J): ${errors.length}`);
    if (errors.length > 0) {
      console.table(
        errors.map((t) => ({
          série: t.name,
          episodios_unicos: t.uniqueEpisodesSeen,
          total_tmdb: t.tmdbTotalMainEpisodes,
          status_calculado: t.statusCalculated,
          regra: t.ruleApplied,
        }))
      );
    }
    console.log(`Inconsistências reais de contagem (episodesMarked ≠ uniqueEpisodesSeen): ${mismatches.length}`);
    if (mismatches.length > 0) {
      console.table(
        mismatches.map((t) => ({
          série: t.name,
          esperado: t.sanityMismatch?.expected,
          gravado: t.sanityMismatch?.actual,
        }))
      );
    }
    console.groupEnd();
  }

  printAuditSample(sampleSize = 10) {
    const byStatus: Record<ResolvedStatus, ReconstructionTrace[]> = {
      completed: [],
      watching: [],
      want_to_watch: [],
      up_to_date: [],
    };
    for (const t of this.traces) {
      if (t.statusCalculated) byStatus[t.statusCalculated].push(t);
    }

    console.group("%c[TASK-027F/J] Amostra de auditoria (10 de cada categoria)", "font-weight: bold; color: #4FD1C5");
    for (const status of ["completed", "watching", "up_to_date", "want_to_watch"] as const) {
      const sample = byStatus[status].slice(0, sampleSize);
      console.log(`--- ${status} (${byStatus[status].length} no total, mostrando ${sample.length}) ---`);
      console.table(
        sample.map((t) => ({
          série: t.name,
          watch_events_bruto: t.totalWatchEvents,
          episodios_unicos: t.uniqueEpisodesSeen,
          episódios_tmdb: t.tmdbTotalMainEpisodes ?? "?",
          episódios_gravados: t.episodesMarked,
          status_esperado: t.statusExpected,
          status_obtido: t.statusCalculated,
        }))
      );
    }
    console.groupEnd();
  }

  getTraces() {
    return this.traces;
  }
}
