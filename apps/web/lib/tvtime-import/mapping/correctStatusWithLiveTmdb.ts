import type { ResolvedStatus } from "./resolveStatus";
import { decideWatchingVsUpToDate, type LiveEpisodeAirDate } from "@/lib/queries/airDateCategory";

export interface CorrectionResult {
  status: ResolvedStatus;
  reason: string | null;
}

/**
 * TASK-166 (reescrita fiel) — cópia direta da estrutura de
 * `resolveCategory` (lib/tvtime-migration/category.ts), sem
 * reinterpretar nada. Ponto que a primeira versão desta função
 * errou: em `resolveCategory`, "completed" NUNCA é um valor de
 * entrada (`base`) — o mapeamento direto do CSV (`CSV_TO_CATEGORY`)
 * só produz watching/want_to_watch/paused/up_to_date; "completed" só
 * nasce ali dentro, da checagem `seriesEnded && tudo assistido`. A
 * primeira versão daqui deixava `resolveStatus.ts` (deste
 * importador) decidir "completed" ANTES, usando o total desatualizado
 * de `SeasonSummary` (estrutura de temporadas, sem data de exibição)
 * — e só reavaliava quem tivesse ficado "watching", nunca quem já
 * tivesse ficado "completed" errado por esse motivo. Corrigido:
 * agora, sempre que há dado ao vivo disponível, TODO `baseStatus`
 * que não seja "want_to_watch" (watching OU completed vindo de
 * `resolveStatus.ts`) é reavaliado do zero — exatamente como
 * `resolveCategory` reavalia todo `base` que não seja
 * want_to_watch/paused.
 *
 * `mainEpisodesTotal` (equivalente a `mainEpisodesTotal` de
 * `resolveCategory`) só é usado como FALLBACK, quando não há
 * `liveEpisodes` — mesma prioridade de `resolveCategory`
 * (`nonSpecialLiveEpisodes ? ... : mainEpisodesTotal`).
 */
export function correctStatusWithLiveTmdb(
  baseStatus: ResolvedStatus,
  mainEpisodesWatched: number,
  mainEpisodesTotal: number,
  seriesEnded: boolean,
  liveEpisodes: LiveEpisodeAirDate[] | null
): CorrectionResult {
  if (baseStatus === "want_to_watch") {
    return { status: baseStatus, reason: null };
  }

  const totalKnown = liveEpisodes && liveEpisodes.length > 0 ? liveEpisodes.length : mainEpisodesTotal;
  const allEpisodesWatchedOverall = totalKnown > 0 && mainEpisodesWatched >= totalKnown;

  if (seriesEnded && allEpisodesWatchedOverall) {
    return {
      status: "completed",
      reason: `Série encerrada oficialmente e todos os ${totalKnown} episódios principais assistidos.`,
    };
  }

  if (liveEpisodes && liveEpisodes.length > 0) {
    const decision = decideWatchingVsUpToDate(mainEpisodesWatched, liveEpisodes);
    return { status: decision.category, reason: decision.reason };
  }

  return { status: baseStatus, reason: null };
}
