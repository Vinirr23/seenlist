import type { ParsedShow } from "../mapping/types";
import type { ScoredCandidate } from "../tmdb/scoring";
import type { SeasonSummary } from "../tmdb/disambiguateByHistory";
import { resolveStatus } from "../mapping/resolveStatus";

export interface CandidateDiagnostic {
  tmdbId: number;
  title: string;
  year: number | null;
  /** Soma de episódios de temporada >= 1 (mesma regra de exclusão de especiais já usada em reconstructProgress.ts) — null quando não deu pra buscar a estrutura de temporadas desse candidato. */
  episodeCount: number | null;
  score: number;
  aliases: string[];
  popularity: number;
}

export type PendencyReason =
  | "Nenhum candidato encontrado"
  | "Nenhum candidato atingiu confiança mínima"
  | "Quantidade de episódios incompatível"
  | "Ano conflitante"
  | "Alias conflitante"
  | "Score empatado";

export interface PendencyDiagnostic {
  tvTimeName: string;
  nbEpisodesSeen: number;
  /** Especulativo: computado contra o candidato de maior score, só pra diagnóstico — nunca decide nada, a série continua indo pra confirmação manual do mesmo jeito. */
  speculativeStatus: string;
  candidates: CandidateDiagnostic[];
  reason: PendencyReason;
  decision: "Confirmação manual" | "Não encontrada";
}

/**
 * TASK-027E — "quero saber exatamente qual regra impediu a decisão
 * automática. Nunca apenas 'Score baixo'." Esta função é
 * EXCLUSIVAMENTE diagnóstica: olha os mesmos dados que o matching já
 * calculou (score, ano, episódios, aliases) e tenta explicar por que
 * a pendência aconteceu, na ORDEM abaixo. Ela NUNCA é chamada pelo
 * caminho de decisão real (matchShow.ts) — só depois que a decisão
 * (aceitar/pendência) já foi tomada, só pra registrar o motivo.
 */
function classifyReason(
  nbEpisodesSeen: number,
  candidates: CandidateDiagnostic[],
  autoAcceptThreshold: number,
  tvTimeName: string
): PendencyReason {
  if (candidates.length === 0) return "Nenhum candidato encontrado";

  const [best, second] = [...candidates].sort((a, b) => b.score - a.score);
  if (!best) return "Nenhum candidato encontrado";

  if (best.score < autoAcceptThreshold) return "Nenhum candidato atingiu confiança mínima";

  // Quantidade de episódios incompatível: nb_episodes_seen já elimina
  // um dos dois principais candidatos, mas essa checagem hoje só é
  // usada durante RECONSTRUÇÃO (pós-match, reconstructProgress.ts),
  // não durante o matching — por isso ainda pendencia mesmo quando
  // esse dado já daria a resposta sozinho.
  if (second && best.episodeCount !== null && second.episodeCount !== null) {
    const bestFits = nbEpisodesSeen <= best.episodeCount;
    const secondFits = nbEpisodesSeen <= second.episodeCount;
    if (bestFits !== secondFits) return "Quantidade de episódios incompatível";
  }

  // Ano conflitante: candidatos plausíveis com anos claramente
  // diferentes, sem nenhum ano do lado do TV Time pra desempatar (o
  // GDPR real não tem esse campo — ver /docs/tvtime-gdpr-spec.md).
  if (second && best.year !== null && second.year !== null && Math.abs(best.year - second.year) >= 3) {
    return "Ano conflitante";
  }

  // Alias conflitante: ou nenhum candidato tem alias batendo com o
  // nome do TV Time, ou mais de um bate (não dá pra usar como
  // desempate único).
  const normalizedQuery = tvTimeName.trim().toLowerCase();
  const aliasMatches = candidates.filter((c) => c.aliases.some((a) => a.trim().toLowerCase() === normalizedQuery));
  if (aliasMatches.length !== 1) return "Alias conflitante";

  return "Score empatado";
}

export class PendencyDiagnosticsCollector {
  private records: PendencyDiagnostic[] = [];

  record(
    show: ParsedShow,
    scoredCandidates: ScoredCandidate[],
    summaries: Record<number, SeasonSummary>,
    autoAcceptThreshold: number,
    decision: "Confirmação manual" | "Não encontrada"
  ) {
    const candidates: CandidateDiagnostic[] = scoredCandidates.map((c) => {
      const summary = summaries[c.tmdbId];
      const episodeCount = summary
        ? summary.seasons.filter((s) => s.seasonNumber >= 1).reduce((sum, s) => sum + s.episodeCount, 0)
        : null;
      return {
        tmdbId: c.tmdbId,
        title: c.title,
        year: c.year,
        episodeCount,
        score: c.score,
        aliases: summary?.alternativeTitles ?? [],
        popularity: c.popularity,
      };
    });

    const best = [...candidates].sort((a, b) => b.score - a.score)[0];
    const speculativeUniqueEpisodes =
      best && best.episodeCount !== null
        ? Math.min(show.totalWatchEvents, best.episodeCount)
        : show.totalWatchEvents;
    const speculativeStatus = resolveStatus(
      speculativeUniqueEpisodes,
      show.isExplicitlyForLater,
      best?.episodeCount ?? null
    );

    const reason = classifyReason(show.totalWatchEvents, candidates, autoAcceptThreshold, show.name);

    this.records.push({
      tvTimeName: show.name,
      nbEpisodesSeen: show.totalWatchEvents,
      speculativeStatus,
      candidates,
      reason,
      decision,
    });
  }

  print() {
    for (const record of this.records) {
      const lines: string[] = [
        "=".repeat(36),
        "",
        "TV Time:",
        record.tvTimeName,
        "",
        "nb_episodes_seen:",
        String(record.nbEpisodesSeen),
        "",
        "Status reconstruído (especulativo, contra o melhor candidato):",
        record.speculativeStatus,
        "",
        "-".repeat(36),
      ];

      record.candidates.forEach((candidate, index) => {
        lines.push(
          "",
          `Candidato ${index + 1}`,
          "",
          "TMDB:",
          candidate.title,
          "",
          "Ano:",
          String(candidate.year ?? "desconhecido"),
          "",
          "Episódios:",
          String(candidate.episodeCount ?? "desconhecido"),
          "",
          "Score:",
          String(candidate.score),
          "",
          "Aliases:",
          candidate.aliases.length > 0 ? candidate.aliases.join(", ") : "(nenhum)",
          "",
          "Popularidade:",
          String(candidate.popularity),
          "",
          "-".repeat(36)
        );
      });

      lines.push(
        "",
        "Motivo da pendência:",
        "",
        record.reason,
        "",
        "-".repeat(36),
        "",
        "Decisão:",
        "",
        record.decision,
        "=".repeat(36)
      );

      console.log(lines.join("\n"));
    }
  }

  printSummary() {
    const total = this.records.length;
    const byReason = new Map<PendencyReason, number>();
    for (const record of this.records) {
      byReason.set(record.reason, (byReason.get(record.reason) ?? 0) + 1);
    }

    const lines = [`Pendências totais: ${total}`, "", "Motivos:", ""];
    for (const [reason, count] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      lines.push(`${count} (${percentage}%) → ${reason}`);
    }

    const dominant = [...byReason.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant && total > 0 && dominant[1] / total >= 0.5) {
      lines.push(
        "",
        `⚠ "${dominant[0]}" responde por ${Math.round((dominant[1] / total) * 100)}% das pendências — provável gargalo único.`
      );
    }

    console.log(lines.join("\n"));
  }

  getRecords() {
    return this.records;
  }
}
