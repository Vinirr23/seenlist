import { resolveStatus, type ResolvedStatus } from "../mapping/resolveStatus";

export type PipelineStage =
  | "parser"
  | "matching"
  | "tmdb"
  | "reconstrução"
  | "resolveStatus"
  | "gravação"
  | "leitura do banco";

export interface FullPipelineTrace {
  rawName: string;
  nbEpisodesSeen: number;
  isExplicitlyForLater: boolean;
  isFavoriteRaw: boolean;
  knownEpisodesCount: number;

  tmdbId: number | null;
  matchedTitle: string | null;
  matchScore: number | null;
  matchReason: string;

  tmdbNumberOfSeasons: number | null;
  tmdbTotalMainEpisodes: number | null;
  seasonsIgnored: number | null;

  uniqueEpisodesSeen: number | null;
  totalWatchEvents: number;
  confidence: number | null;

  statusCalculated: ResolvedStatus | null;
  statusRule: string | null;

  wasSkippedByIdempotency: boolean;
  writtenStatus: string | null;
  writtenEpisodeCount: number | null;
  writtenFavorite: boolean | null;

  readBackStatus: string | null;
  readBackEpisodeCount: number | null;
  readBackFavorite: boolean | null;

  firstDivergenceStage: PipelineStage | null;
  divergenceDetail: string | null;
}

/**
 * TASK-027K — "não aceito 'provavelmente', quero a primeira função
 * onde o valor virou incorreto". Esta função RECALCULA cada etapa a
 * partir do que a etapa anterior registrou (usando as mesmas funções
 * puras do pipeline real — resolveStatus, o mesmo min() de
 * reconstructProgress.ts) e compara com o que foi de fato registrado.
 * A primeira etapa onde a comparação falha é a resposta.
 *
 * Limite honesto: "parser", "matching" e "tmdb" não têm uma segunda
 * fórmula pra comparar contra (é dado bruto, não existe "resultado
 * esperado" calculável sem uma fonte externa de verdade sobre qual
 * TMDB ID é o correto). A detecção automática cobre a partir de
 * "reconstrução" — as etapas anteriores entram no relatório só pra
 * contexto/leitura humana.
 */
export function detectFirstDivergence(
  trace: Omit<FullPipelineTrace, "firstDivergenceStage" | "divergenceDetail">
): { stage: PipelineStage | null; detail: string | null } {
  if (trace.tmdbId === null) {
    return { stage: "matching", detail: "Série não foi identificada no TMDB — pipeline para aqui." };
  }

  if (trace.tmdbTotalMainEpisodes !== null && trace.uniqueEpisodesSeen !== null) {
    const expectedUnique = Math.min(trace.totalWatchEvents, trace.tmdbTotalMainEpisodes);
    if (trace.uniqueEpisodesSeen !== expectedUnique) {
      return {
        stage: "reconstrução",
        detail: `uniqueEpisodesSeen registrado como ${trace.uniqueEpisodesSeen}, mas min(totalWatchEvents=${trace.totalWatchEvents}, tmdbTotalMainEpisodes=${trace.tmdbTotalMainEpisodes}) = ${expectedUnique}.`,
      };
    }
  }

  if (!trace.wasSkippedByIdempotency && trace.uniqueEpisodesSeen !== null && trace.statusCalculated !== null) {
    const expectedStatus = resolveStatus(
      trace.uniqueEpisodesSeen,
      trace.isExplicitlyForLater,
      trace.tmdbTotalMainEpisodes
    );
    if (expectedStatus !== trace.statusCalculated) {
      return {
        stage: "resolveStatus",
        detail: `resolveStatus(${trace.uniqueEpisodesSeen}, ${trace.isExplicitlyForLater}, ${trace.tmdbTotalMainEpisodes}) deveria devolver "${expectedStatus}", mas o pipeline registrou "${trace.statusCalculated}" — o bug está em QUAIS valores foram passados pra resolveStatus no call site, não na função em si.`,
      };
    }
  }

  if (!trace.wasSkippedByIdempotency && trace.statusCalculated !== null && trace.writtenStatus !== null) {
    if (trace.writtenStatus !== trace.statusCalculated) {
      return {
        stage: "gravação",
        detail: `Calculado "${trace.statusCalculated}", mas o valor enviado ao Supabase foi "${trace.writtenStatus}".`,
      };
    }
  }

  if (trace.writtenStatus !== null && trace.readBackStatus !== null) {
    if (trace.readBackStatus !== trace.writtenStatus) {
      return {
        stage: "leitura do banco",
        detail: `Escrito "${trace.writtenStatus}", mas reconsultando a tabela logo depois veio "${trace.readBackStatus}" — sinal de RLS bloqueando parcialmente, upsert com ignoreDuplicates pulando a escrita, ou outra série sobrescrevendo a mesma linha.`,
      };
    }
  }

  return { stage: null, detail: null };
}

export class FullPipelineAuditCollector {
  private traces: FullPipelineTrace[] = [];

  record(partial: Omit<FullPipelineTrace, "firstDivergenceStage" | "divergenceDetail">) {
    const { stage, detail } = detectFirstDivergence(partial);
    this.traces.push({ ...partial, firstDivergenceStage: stage, divergenceDetail: detail });
  }

  private printGroup(label: string, traces: FullPipelineTrace[], sampleSize: number) {
    const sample = traces.slice(0, sampleSize);
    console.group(
      `%c[TASK-027K] ${label} (${traces.length} no total, mostrando ${sample.length})`,
      "font-weight: bold; color: #E8A33D"
    );
    for (const t of sample) {
      console.log(
        [
          "=".repeat(40),
          `Nome (GDPR): ${t.rawName}`,
          "",
          "1. Parser:",
          `  nb_episodes_seen: ${t.nbEpisodesSeen} | for_later: ${t.isExplicitlyForLater} | favorito: ${t.isFavoriteRaw} | episódios granulares conhecidos: ${t.knownEpisodesCount}`,
          "",
          "2. Matching:",
          `  tmdbId: ${t.tmdbId ?? "—"} | título encontrado: ${t.matchedTitle ?? "—"} | score: ${t.matchScore ?? "—"} | motivo: ${t.matchReason}`,
          "",
          "3. TMDB:",
          `  temporadas: ${t.tmdbNumberOfSeasons ?? "—"} | temporadas ignoradas (especiais): ${t.seasonsIgnored ?? "—"} | episódios principais considerados: ${t.tmdbTotalMainEpisodes ?? "—"}`,
          "",
          "4. Reconstrução:",
          `  uniqueEpisodesSeen: ${t.uniqueEpisodesSeen ?? "—"} | totalWatchEvents: ${t.totalWatchEvents} | confiança: ${t.confidence ?? "—"}`,
          "",
          "5. Status calculado:",
          `  ${t.statusCalculated ?? "—"} (regra: ${t.statusRule ?? "—"})`,
          "",
          "6. Gravação:",
          `  pulado por idempotência: ${t.wasSkippedByIdempotency} | status enviado: ${t.writtenStatus ?? "—"} | episódios enviados: ${t.writtenEpisodeCount ?? "—"} | favorito enviado: ${t.writtenFavorite ?? "—"}`,
          "",
          "7. Releitura do banco:",
          `  status lido: ${t.readBackStatus ?? "—"} | episódios lidos: ${t.readBackEpisodeCount ?? "—"} | favorito lido: ${t.readBackFavorite ?? "—"}`,
          "",
          "8/9. Comparação:",
          t.firstDivergenceStage
            ? `  ⚠ PRIMEIRA DIVERGÊNCIA: etapa "${t.firstDivergenceStage}" — ${t.divergenceDetail}`
            : "  ✅ Nenhuma divergência — todas as etapas batem com a regra esperada.",
          "=".repeat(40),
        ].join("\n")
      );
    }
    console.groupEnd();
  }

  printSamples(sampleSize = 20) {
    const completed = this.traces.filter((t) => t.statusCalculated === "completed");
    const watching = this.traces.filter((t) => t.statusCalculated === "watching");
    const wantToWatch = this.traces.filter((t) => t.statusCalculated === "want_to_watch");

    this.printGroup("Concluídas", completed, sampleSize);
    this.printGroup("Assistindo", watching, sampleSize);
    this.printGroup("Assistir depois", wantToWatch, sampleSize);

    const withDivergence = this.traces.filter((t) => t.firstDivergenceStage !== null);
    console.group("%c[TASK-027K] Resumo de divergências", "font-weight: bold; color: #E8574A");
    console.log(`Total de séries auditadas: ${this.traces.length}`);
    console.log(`Séries com divergência encontrada: ${withDivergence.length}`);
    if (withDivergence.length > 0) {
      const byStage = new Map<string, number>();
      for (const t of withDivergence) {
        const key = t.firstDivergenceStage as string;
        byStage.set(key, (byStage.get(key) ?? 0) + 1);
      }
      console.table([...byStage.entries()].map(([stage, count]) => ({ etapa: stage, quantidade: count })));
      console.table(
        withDivergence.map((t) => ({
          série: t.rawName,
          etapa: t.firstDivergenceStage,
          detalhe: t.divergenceDetail,
        }))
      );
    }
    console.groupEnd();
  }

  getTraces() {
    return this.traces;
  }
}
