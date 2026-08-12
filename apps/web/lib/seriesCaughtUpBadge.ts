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
 *
 * CORREÇÃO (a pedido — auditoria a fundo, mesmo padrão de bug já
 * corrigido em outros 4 lugares nesta sessão) — dois ajustes:
 * `airDate === null` não exclui mais um episódio da contagem (TMDB
 * às vezes demora a preencher a data do mais recente — sem isso, o
 * selo "em dia"/confete de conclusão podia disparar cedo demais,
 * ignorando um episódio que já saiu de verdade só porque a data
 * ainda não chegou na API); e "hoje" agora é fuso LOCAL, não UTC.
 */
export function computeSeriesCaughtUpBadge(
  series: Pick<SeriesDetails, "seasons" | "status">,
  watched: Set<WatchedEpisodeKey> | undefined
): SeriesCaughtUpBadge {
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

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
