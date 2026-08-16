import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface LightEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
}

export interface LightSeason {
  seasonNumber: number;
  episodes: LightEpisode[];
}

/**
 * AUDITORIA (perf, a pedido) — `ContinueWatchingCard.tsx` usava
 * `useSeriesDetails` (mesma consulta da PÁGINA da série: elenco,
 * sinopse, títulos similares, imagens de cada episódio) só pra
 * achar "qual é o próximo episódio não assistido". Com até 8 cards
 * na lista, isso virava até 8 requisições pesadas em paralelo toda
 * vez que a Central de Séries abria — a maior parte do dado baixado
 * nunca era usada pra nada ali.
 *
 * Reaproveita a MESMA rota já usada pelo recálculo automático de
 * categoria (`/api/tmdb/series-episodes-at-export`) — devolve só
 * temporada/episódio/nome/data de exibição, nada mais. Fica pra
 * decisão de quem chama juntar isso em temporadas (`groupBySeason`)
 * no formato que `findNextUnwatched` já esperava.
 *
 * Escopo desta mudança, de propósito: SÓ o `ContinueWatchingCard`
 * passa a usar isto. `useSeriesDetails` continua exatamente igual,
 * usado pela página de detalhe da série (que precisa mesmo de
 * elenco/sinopse/etc.) — nada mudou lá.
 */
async function fetchLightEpisodes(seriesId: number, language: string): Promise<LightEpisode[]> {
  const response = await fetch("/api/tmdb/series-episodes-at-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seriesIds: [seriesId], language }),
  });
  if (!response.ok) {
    throw new Error("light episodes fetch failed");
  }
  const data = (await response.json()) as { series: { id: number; episodes: LightEpisode[] }[] };
  return data.series[0]?.episodes ?? [];
}

export function groupBySeason(episodes: LightEpisode[]): LightSeason[] {
  const bySeason = new Map<number, LightEpisode[]>();
  for (const episode of episodes) {
    const list = bySeason.get(episode.seasonNumber);
    if (list) {
      list.push(episode);
    } else {
      bySeason.set(episode.seasonNumber, [episode]);
    }
  }
  return [...bySeason.entries()].map(([seasonNumber, eps]) => ({ seasonNumber, episodes: eps }));
}

export function useSeriesEpisodesLight(seriesId: number) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["series-episodes-light", seriesId, locale],
    queryFn: () => fetchLightEpisodes(seriesId, locale),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
