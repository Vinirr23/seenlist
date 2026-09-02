import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface LightEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  airDate: string | null;
  /**
   * CORREÇÃO (2026-08-26, achado real ao concluir o "motor resistente" —
   * `ContinueWatchingCard.tsx` já lia `live.episode.id`, campo que NUNCA
   * existiu aqui nem na resposta da API (`series-episodes-at-export/route.ts`
   * devolve `episodeId`, não `id`) — `episodeId` sempre saía `undefined`
   * ao marcar um episódio como assistido por este card específico, então
   * o ID fixo da TMDB nunca era gravado por esse caminho, mesmo depois da
   * migração/coluna nova existirem. Nome do campo agora bate com o que a
   * API de fato devolve.
   */
  episodeId: number;
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
  const data = (await response.json()) as { series: { id: number; episodes: LightEpisode[] }[]; failedIds?: number[] };
  /**
   * CORREÇÃO (bug real, root cause — "só o Reacher aparece em Continue
   * assistindo na Home") — ver comentário completo em
   * `app/api/tmdb/series-episodes-at-export/route.ts`. Antes, uma
   * falha da TMDB pra ESTA série específica virava silenciosamente
   * `episodes: []` (a rota inteira continuava `200 OK`) — o React
   * Query via isso como sucesso normal, nunca tentava de novo, e o
   * card (`ContinueWatchingCard.tsx`) ficava permanentemente escondido
   * (mesmo tratamento visual de "não tem episódio pendente"). Agora a
   * rota avisa QUAIS ids realmente falharam (`failedIds`) — se o
   * nosso `seriesId` está nessa lista, isto aqui LANÇA (erro de
   * verdade), o que liga o retry automático do React Query (padrão do
   * projeto — `app/providers.tsx` não desliga `retry`); a série se
   * recupera sozinha assim que uma tentativa seguinte funcionar, sem
   * precisar sair da tela nem esperar os 5 minutos de cache expirar.
   */
  if (data.failedIds?.includes(seriesId)) {
    throw new Error(`[useSeriesEpisodesLight] Busca de episódios falhou pra série ${seriesId} — tentando de novo.`);
  }
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
