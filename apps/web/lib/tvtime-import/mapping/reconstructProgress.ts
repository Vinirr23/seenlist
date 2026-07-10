import type { GranularEpisodeSignal, ParsedShow } from "./types";

export interface SeasonSummary {
  numberOfSeasons: number;
  seasons: { seasonNumber: number; episodeCount: number }[];
}

/**
 * TASK-027C, item 5 — "informação interna, não mostrar ao usuário".
 * "deterministic": reconstrução limpa, sem nenhuma evidência granular
 * contradizendo a fatia "primeiros N". "partial": a confiança foi
 * reduzida por causa de episódio granular fora da fatia. "needs_review":
 * o TMDB não devolveu estrutura nenhuma pra essa série — isso é
 * diferente de "totalWatchEvents é maior que o total" (que TASK-027J
 * deixou de tratar como problema — ver reviewReason/uniqueEpisodesSeen
 * abaixo).
 */
export type ReconstructionKind = "deterministic" | "partial" | "needs_review";

export interface ReconstructedProgress {
  /** Os episódios únicos oficiais do TMDB, em ordem cronológica, que efetivamente serão gravados como assistidos — sempre uma fatia real de episódios que existem, nunca mais que isso. */
  episodes: { seasonNumber: number; episodeNumber: number }[];
  /** TASK-027J — episodes.length, exposto explicitamente porque é o número usado pra decidir status/próximo episódio daqui pra frente (resolveStatus.ts). Sempre `min(show.totalWatchEvents, total de episódios do TMDB)`. */
  uniqueEpisodesSeen: number;
  /** 0-100. Uso só interno (logs/diagnóstico/auditoria) — nunca mostrado ao usuário. */
  confidence: number;
  needsReview: boolean;
  reviewReason: string | null;
  kind: ReconstructionKind;
  /** TASK-027C, item 6 — calculado uma vez aqui, na importação, pra nunca precisar recalcular toda vez que a Home abrir. */
  nextEpisode: { seasonNumber: number; episodeNumber: number } | null;
}

const CONFIDENCE_DETERMINISTIC_THRESHOLD = 97;

/**
 * TASK-027B — a lista de episódios não vem do GDPR (não existe pra
 * maioria das séries). Vem daqui: estrutura oficial de temporadas do
 * TMDB, em ordem cronológica.
 *
 * Temporada 0 (especiais) é excluída de propósito — TASK-027C, item
 * 7/8. Especiais DENTRO de uma temporada normal não são filtrados —
 * o TMDB não expõe isso barato (exigiria detalhe de CADA temporada
 * de CADA série). Limitação conhecida, documentada, não escondida.
 */
function buildChronologicalEpisodeList(summary: SeasonSummary): { seasonNumber: number; episodeNumber: number }[] {
  const episodes: { seasonNumber: number; episodeNumber: number }[] = [];
  const orderedSeasons = summary.seasons
    .filter((season) => season.seasonNumber >= 1)
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  for (const season of orderedSeasons) {
    for (let episodeNumber = 1; episodeNumber <= season.episodeCount; episodeNumber++) {
      episodes.push({ seasonNumber: season.seasonNumber, episodeNumber });
    }
  }
  return episodes;
}

/**
 * Confiança: 100 quando `uniqueEpisodesSeen` cobre tudo que o TMDB
 * conhece (caso limpo — "Concluída"). 97 de base pra reconstrução
 * parcial normal. Cada episódio conhecido com certeza (granular) que
 * cai FORA da fatia reconstruída reduz a confiança — sinal de que o
 * usuário não assistiu estritamente em ordem.
 */
function computeConfidence(
  uniqueEpisodesSeen: number,
  chronological: { seasonNumber: number; episodeNumber: number }[],
  knownEpisodes: GranularEpisodeSignal[]
): number {
  let confidence = uniqueEpisodesSeen === chronological.length ? 100 : 97;

  const reconstructedSet = new Set(
    chronological.slice(0, uniqueEpisodesSeen).map((e) => `${e.seasonNumber}-${e.episodeNumber}`)
  );

  for (const known of knownEpisodes) {
    const key = `${known.seasonNumber}-${known.episodeNumber}`;
    if (!reconstructedSet.has(key)) {
      confidence -= 5;
    }
  }

  return Math.max(50, Math.min(100, confidence));
}

/**
 * TASK-027J — mudança central: `uniqueEpisodesSeen = min(totalWatchEvents,
 * total do TMDB)`. Isso substitui o antigo comportamento (TASK-027B/C)
 * de marcar "needs_review" sempre que totalWatchEvents excedia o
 * total do TMDB. A investigação da TASK-027I mostrou, com números
 * reais, que esse excesso normalmente não é erro de correspondência —
 * é reassistida (ex.: Lucifer com quase o dobro do total real). Um
 * `min()` simples resolve isso sem heurística nenhuma: nunca
 * extrapola (mesma garantia de antes), e uma série totalmente
 * reassistida agora vira "Concluída" corretamente, em vez de ficar
 * presa em "precisa de revisão" pra sempre.
 */
export function reconstructProgress(show: ParsedShow, summary: SeasonSummary | null): ReconstructedProgress {
  if (!summary || summary.seasons.length === 0) {
    return {
      episodes: [],
      uniqueEpisodesSeen: 0,
      confidence: 0,
      needsReview: show.totalWatchEvents > 0,
      reviewReason: "TMDB não retornou nenhuma temporada para esta série.",
      kind: show.totalWatchEvents > 0 ? "needs_review" : "deterministic",
      nextEpisode: null,
    };
  }

  const chronological = buildChronologicalEpisodeList(summary);

  if (chronological.length === 0) {
    return {
      episodes: [],
      uniqueEpisodesSeen: 0,
      confidence: 0,
      needsReview: show.totalWatchEvents > 0,
      reviewReason: "A série não tem nenhum episódio cadastrado no TMDB (fora de especiais).",
      kind: show.totalWatchEvents > 0 ? "needs_review" : "deterministic",
      nextEpisode: null,
    };
  }

  const uniqueEpisodesSeen = Math.min(show.totalWatchEvents, chronological.length);
  const episodes = chronological.slice(0, uniqueEpisodesSeen);
  const confidence = computeConfidence(uniqueEpisodesSeen, chronological, show.knownEpisodes);
  const nextEpisode = chronological[uniqueEpisodesSeen] ?? null;

  return {
    episodes,
    uniqueEpisodesSeen,
    confidence,
    needsReview: false,
    reviewReason: null,
    kind: confidence >= CONFIDENCE_DETERMINISTIC_THRESHOLD ? "deterministic" : "partial",
    nextEpisode,
  };
}
