import type { ParsedShow } from "../mapping/types";
import type { ResolvedStatus } from "../mapping/resolveStatus";

export interface ExistingShowState {
  hasStatus: boolean;
  status: ResolvedStatus | null;
  nextSeason: number | null;
  nextEpisode: number | null;
  /** TASK-027J — antes comparava a CONTAGEM de watched_episodes (episódios únicos); agora compara o valor BRUTO persistido (total_watch_events). É mais correto: se o número bruto do TV Time mudou (mesmo sem cruzar pra um episódio único novo — ex.: mais uma reassistida), as estatísticas precisam ser atualizadas mesmo que a biblioteca não mude nada. */
  totalWatchEvents: number | null;
  isFavorite: boolean;
}

/**
 * TASK-027G — ajuste pedido depois do bug do Promise.all: a versão
 * anterior só comparava `episodeCount`/`isFavorite`, então uma série
 * presa em "watching" por causa da falha de lote (season-info
 * retornando `null`) ficava PRA SEMPRE assim.
 *
 * A saída continua assimétrica, de propósito:
 * - Série já "completed", com next_episode/next_season nulos —
 *   continua pulando de verdade, sem custo de TMDB.
 * - Qualquer série que NÃO esteja "completed" — SEMPRE reprocessa,
 *   mesmo que watch events e favorito já batam.
 *
 * TASK-027J — a comparação de progresso trocou de `episodeCount`
 * (derivado, episódios únicos) para `totalWatchEvents` (bruto,
 * persistido) — ver ExistingShowState acima.
 */
export function isShowAlreadyConsistent(show: ParsedShow, existing: ExistingShowState | undefined): boolean {
  if (!existing || !existing.hasStatus) return false;

  const favoriteMatches = existing.isFavorite === show.isFavorite;
  const watchEventsMatch = existing.totalWatchEvents === show.totalWatchEvents;
  const statusIsCompletedAndClean =
    existing.status === "completed" && existing.nextSeason === null && existing.nextEpisode === null;

  return favoriteMatches && watchEventsMatch && statusIsCompletedAndClean;
}
