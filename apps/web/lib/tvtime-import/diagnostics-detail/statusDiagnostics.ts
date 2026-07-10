import type { ResolvedStatus } from "../mapping/resolveStatus";

export interface StatusDiagnostic {
  name: string;
  /** TASK-027J — valor bruto do GDPR, só para contexto/log — não é mais o que decide o status. */
  totalWatchEvents: number;
  /** Valor já separado (min(totalWatchEvents, totalKnownEpisodes)) — este sim é o que resolveStatus.ts realmente usa. */
  uniqueEpisodesSeen: number;
  totalKnownEpisodes: number | null;
  status: ResolvedStatus;
  /** Qual condição de resolveStatus.ts levou a esse status — puramente descritivo, não uma segunda implementação da regra. */
  ruleApplied: string;
  /**
   * true quando uniqueEpisodesSeen >= totalKnownEpisodes mas o status
   * final NÃO é "completed". TASK-027J — com uniqueEpisodesSeen já
   * vindo limitado por min() em reconstructProgress.ts, isso deveria
   * ser estruturalmente IMPOSSÍVEL agora (era o "segundo bug" da
   * TASK-027F/H, causado por comparar o valor BRUTO em vez do
   * separado). Mantido aqui como checagem de sanidade — se voltar a
   * aparecer, é sinal de alguma regressão nessa separação.
   */
  isInconsistent: boolean;
}

/**
 * TASK-027E, segunda parte — describe (sem alterar) por que
 * resolveStatus.ts chegou naquele status. TASK-027J — recebe
 * `uniqueEpisodesSeen` (já separado) além do bruto, só pra contexto.
 */
export function describeStatusDecision(
  name: string,
  totalWatchEvents: number,
  uniqueEpisodesSeen: number,
  totalKnownEpisodes: number | null,
  isExplicitlyForLater: boolean,
  status: ResolvedStatus
): StatusDiagnostic {
  let ruleApplied: string;
  if (isExplicitlyForLater) {
    ruleApplied = "isExplicitlyForLater=true (user_show_special_status.csv, status=for_later)";
  } else if (uniqueEpisodesSeen === 0) {
    ruleApplied = "uniqueEpisodesSeen=0";
  } else if (totalKnownEpisodes !== null && totalKnownEpisodes > 0 && uniqueEpisodesSeen >= totalKnownEpisodes) {
    ruleApplied = "uniqueEpisodesSeen >= totalKnownEpisodes (TMDB)";
  } else {
    ruleApplied = "nenhuma das condições acima — caiu no default 'watching'";
  }

  const isInconsistent =
    status !== "completed" &&
    !isExplicitlyForLater &&
    totalKnownEpisodes !== null &&
    totalKnownEpisodes > 0 &&
    uniqueEpisodesSeen >= totalKnownEpisodes;

  return { name, totalWatchEvents, uniqueEpisodesSeen, totalKnownEpisodes, status, ruleApplied, isInconsistent };
}

export class StatusDiagnosticsCollector {
  private records: StatusDiagnostic[] = [];

  record(diagnostic: StatusDiagnostic) {
    if (diagnostic.status !== "completed") {
      this.records.push(diagnostic);
    }
  }

  print() {
    if (this.records.length === 0) return;

    console.group("%c[tvtime-import] Diagnóstico de status (não-concluídas)", "font-weight: bold; color: #4FD1C5");
    console.table(
      this.records.map((r) => ({
        série: r.name,
        watch_events_bruto: r.totalWatchEvents,
        episodios_unicos: r.uniqueEpisodesSeen,
        episódios_tmdb: r.totalKnownEpisodes ?? "desconhecido",
        status: r.status,
        regra: r.ruleApplied,
        inconsistente: r.isInconsistent ? "⚠ SIM" : "não",
      }))
    );

    const inconsistencies = this.records.filter((r) => r.isInconsistent);
    if (inconsistencies.length > 0) {
      console.warn(
        `⚠ ${inconsistencies.length} série(s) com uniqueEpisodesSeen >= episódios do TMDB mas status ≠ "completed" — isso deveria ser impossível após a TASK-027J (min() já limita o valor). Investigar como regressão.`
      );
    } else {
      console.log(
        "Nenhuma inconsistência de status encontrada (esperado, dado o min() em reconstructProgress.ts)."
      );
    }
    console.groupEnd();
  }

  getInconsistencies() {
    return this.records.filter((r) => r.isInconsistent);
  }
}
