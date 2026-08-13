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
 *
 * CORREÇÃO 2 (bug NOVO, introduzido pela correção acima — reportado
 * "temporada nova confirmada mas SEM data de lançamento apareceu
 * como pendente à toa") — um episódio sem data só conta como "já
 * saiu" se a MESMA temporada tiver pelo menos um outro episódio com
 * data confirmada e já passada (sinal de que a temporada já começou
 * a ir ao ar de verdade). Temporada inteira sem nenhuma data
 * (especulação de futuro, ainda sem estreia) não conta.
 */
export function computeSeriesCaughtUpBadge(
  series: Pick<SeriesDetails, "seasons" | "status">,
  watched: Set<WatchedEpisodeKey> | undefined
): SeriesCaughtUpBadge {
  const today = todayLocalKey();

  const airedNonSpecialEpisodes = series.seasons
    .filter((season) => season.seasonNumber > 0)
    .flatMap((season) => {
      const seasonHasConfirmedAiring = season.episodes.some((e) => e.airDate !== null && e.airDate <= today);
      return season.episodes.filter(
        (episode) => (episode.airDate !== null && episode.airDate <= today) || (episode.airDate === null && seasonHasConfirmedAiring)
      );
    });

  if (airedNonSpecialEpisodes.length === 0) return null;

  const watchedSet = watched ?? new Set<WatchedEpisodeKey>();
  const allAiredWatched = airedNonSpecialEpisodes.every((episode) =>
    watchedSet.has(episodeKey(episode.seasonNumber, episode.episodeNumber))
  );
  if (!allAiredWatched) return null;

  const seriesEnded = series.status === "Ended" || series.status === "Canceled";
  return seriesEnded ? "ended" : "ongoing";
}
