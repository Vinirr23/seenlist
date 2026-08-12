import type { SeriesDetails } from "@seenlist/types";
import { episodeKey, type WatchedEpisodeKey } from "./seriesDetails";
import { todayLocalKey } from "./localDate";

export type SeriesCaughtUpBadge = "ongoing" | "ended" | null;

/**
 * TASK-170 — porta de `lib/seriesCaughtUpBadge.ts` do web. Ver comentário lá pro raciocínio completo.
 *
 * CORREÇÃO (a pedido — auditoria a fundo, mesmo padrão de bug
 * encontrado e corrigido em outros 4 lugares nesta sessão) — dois
 * ajustes: `airDate === null` não exclui mais um episódio (TMDB às
 * vezes demora a preencher a data do mais recente — sem isso, "você
 * está em dia" podia disparar cedo demais, contando errado o que já
 * saiu de verdade); e "hoje" agora usa `todayLocalKey()` (fuso
 * local), não `toISOString()` (UTC) — esse arquivo especificamente
 * nunca tinha adotado o helper que o resto do mobile já usa.
 */
export function computeSeriesCaughtUpBadge(
  series: Pick<SeriesDetails, "seasons" | "status">,
  watched: Set<WatchedEpisodeKey> | undefined
): SeriesCaughtUpBadge {
  const today = todayLocalKey();

  const airedNonSpecialEpisodes = series.seasons
    .filter((season) => season.seasonNumber > 0)
    .flatMap((season) => season.episodes)
    .filter((episode) => episode.airDate === null || episode.airDate <= today);

  if (airedNonSpecialEpisodes.length === 0) return null;

  const watchedSet = watched ?? new Set<WatchedEpisodeKey>();
  const allAiredWatched = airedNonSpecialEpisodes.every((episode) =>
    watchedSet.has(episodeKey(episode.seasonNumber, episode.episodeNumber))
  );
  if (!allAiredWatched) return null;

  const seriesEnded = series.status === "Ended" || series.status === "Canceled";
  return seriesEnded ? "ended" : "ongoing";
}
