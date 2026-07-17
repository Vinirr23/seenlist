import type { ResolvedStatus } from "./resolveStatus";
import { decideWatchingVsUpToDate, type LiveEpisodeAirDate } from "@/lib/queries/airDateCategory";

export interface CorrectionResult {
  status: ResolvedStatus;
  reason: string | null;
}

/**
 * TASK-166 — o importador GDPR (`resolveStatus.ts`) decidia status
 * só com a contagem bruta do TMDB (`totalKnownEpisodes`, TODOS os
 * episódios já anunciados, incluindo os que ainda nem foram ao ar).
 * Pra série em andamento, isso quase nunca bate — o usuário nunca
 * consegue ter visto um episódio que ainda nem estreou, então a
 * série ficava presa em "watching" pra sempre, mesmo already em dia
 * com tudo que já saiu. É a mesma causa raiz já corrigida no
 * importador por extensão (TASK-042/043, `category.ts`) e na
 * Biblioteca ao vivo (`seriesCategoryRecalc.ts`) — esta função
 * replica a MESMA lógica (mesma função compartilhada
 * `decideWatchingVsUpToDate`), só que aplicada depois de
 * `resolveStatus.ts` em vez de substituí-lo, pra não mexer numa
 * função já testada (`resolveStatus.test.ts`) sem necessidade.
 *
 * Dois ajustes em cima do que `resolveStatus.ts` decidiu:
 *   1. Série encerrada no TMDB (`ended`) + tudo que já foi ao ar
 *      assistido → "completed", mesmo que `resolveStatus` tenha
 *      decidido "watching" (porque `totalKnownEpisodes` incluía
 *      episódio anunciado que nunca chegou a estrear de verdade).
 *   2. Série "watching" com dado de episódio ao vivo disponível →
 *      reavaliada por `decideWatchingVsUpToDate` (mesma função da
 *      Biblioteca/extensão) — vira "up_to_date" quando não sobra
 *      nenhum episódio JÁ LANÇADO sem assistir.
 *
 * "want_to_watch" nunca é tocado aqui — mesma decisão explícita já
 * documentada em `resolveStatus.ts` (status explícito ou zero
 * episódios visto não muda por causa de data de exibição).
 */
export function correctStatusWithLiveTmdb(
  baseStatus: ResolvedStatus,
  uniqueEpisodesSeen: number,
  ended: boolean,
  liveEpisodes: LiveEpisodeAirDate[] | null
): CorrectionResult {
  if (baseStatus === "want_to_watch") {
    return { status: baseStatus, reason: null };
  }

  if (!liveEpisodes || liveEpisodes.length === 0) {
    return { status: baseStatus, reason: null };
  }

  const allEpisodesWatchedOverall = uniqueEpisodesSeen >= liveEpisodes.length;

  if (ended && allEpisodesWatchedOverall && baseStatus !== "completed") {
    return {
      status: "completed",
      reason: `Série encerrada no TMDB e todos os ${liveEpisodes.length} episódios principais assistidos — corrigido de "${baseStatus}" para "completed".`,
    };
  }

  if (baseStatus === "watching") {
    const decision = decideWatchingVsUpToDate(uniqueEpisodesSeen, liveEpisodes);
    if (decision.category !== baseStatus) {
      return { status: decision.category, reason: decision.reason };
    }
  }

  return { status: baseStatus, reason: null };
}
