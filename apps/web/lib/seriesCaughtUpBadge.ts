import type { SeriesDetails } from "@seenlist/types";
import { episodeKey, type WatchedEpisodeKey } from "./queries/watched-episodes-state";

export type SeriesCaughtUpBadge = "ongoing" | "ended" | null;

/**
 * TASK-170 — "mais episódios a caminho" (série continua, você já viu
 * tudo que já saiu) vs "série encerrada" (você viu tudo, e não vai
 * sair mais nada). Mesmo raciocínio já usado em
 * `decideWatchingVsUpToDate`/`correctStatusWithLiveTmdb`: episódio
 * JÁ LANÇADO é o que importa (data de exibição real, não o total
 * anunciado no TMDB, que pode incluir episódio futuro sem data
 * ainda) — só que aqui aplicado à tela de episódios em si, não à
 * categoria da Biblioteca.
 *
 * `null` quando não está em dia (ainda falta episódio já lançado
 * pra assistir) — o card não aparece nesse caso.
 */
export function computeSeriesCaughtUpBadge(
  series: Pick<SeriesDetails, "seasons" | "status">,
  watched: Set<WatchedEpisodeKey> | undefined
): SeriesCaughtUpBadge {
  const today = new Date().toISOString().slice(0, 10);

  const airedNonSpecialEpisodes = series.seasons
    .filter((season) => season.seasonNumber > 0)
    .flatMap((season) => season.episodes)
    .filter((episode) => episode.airDate !== null && episode.airDate <= today);

  if (airedNonSpecialEpisodes.length === 0) return null;

  const watchedSet = watched ?? new Set<WatchedEpisodeKey>();
  const allAiredWatched = airedNonSpecialEpisodes.every((episode) =>
    watchedSet.has(episodeKey(episode.seasonNumber, episode.episodeNumber))
  );
  if (!allAiredWatched) return null;

  const seriesEnded = series.status === "Ended" || series.status === "Canceled";
  return seriesEnded ? "ended" : "ongoing";
}
