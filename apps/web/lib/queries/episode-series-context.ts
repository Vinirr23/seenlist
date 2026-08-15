import { useQuery } from "@tanstack/react-query";
import type { CastMember } from "@seenlist/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export interface EpisodeContextEpisode {
  seasonNumber: number;
  episodeNumber: number;
}

export interface EpisodeContextSeason {
  seasonNumber: number;
  episodes: EpisodeContextEpisode[];
}

export interface EpisodeContextPayload {
  title: string;
  matchTitle: string;
  firstAirDate: string | null;
  cast: CastMember[];
  seasons: EpisodeContextSeason[];
}

async function fetchEpisodeSeriesContext(seriesId: string, season: number, language: string): Promise<EpisodeContextPayload> {
  const response = await fetch(`/api/tmdb/series/${seriesId}/season/${season}/episode-context?language=${language}`);
  if (!response.ok) throw new Error("episode series context fetch failed");
  return response.json() as Promise<EpisodeContextPayload>;
}

/**
 * ACHADO DE PERFORMANCE (a pedido — auditoria da tela de Episódio) —
 * antes, abrir um episódio direto (o caminho mais comum: card
 * "Continue assistindo" na Home, ou notificação — sem passar pela
 * tela da Série antes) usava `useSeriesDetails`, a MESMA consulta
 * pesada da página da série inteira: elenco completo, trailer,
 * galeria, títulos parecidos, e o episódio de TODAS as temporadas
 * (uma chamada ao TMDB por temporada). Pra uma série de 8 temporadas,
 * isso é 10 chamadas em paralelo só pra abrir UM episódio — a tela
 * de Episódio só usa uma fração pequena disso (título/elenco pra
 * personagem de anime, e só o NÚMERO de cada episódio de cada
 * temporada, só pra achar "anterior/próximo").
 *
 * "Anterior/próximo" nunca pula mais de uma temporada de distância —
 * por isso a rota (`episode-context/route.ts`) só busca a temporada
 * ATUAL + a ANTERIOR + a SEGUINTE (no máximo 3 chamadas ao TMDB, não
 * uma por temporada da série inteira).
 *
 * Chave de cache é `[seriesId, season]` (NÃO inclui o episódio) DE
 * PROPÓSITO — passar do episódio 3 pro 4 da MESMA temporada
 * (maratonando) não busca nada de novo; só troca ao mudar de
 * temporada.
 *
 * Escopo DELIBERADAMENTE estreito, mesmo espírito da correção já
 * aplicada em `ContinueWatchingCard.tsx`/`seriesEpisodesLight.ts` —
 * só a tela de Episódio passa a usar isto. `useSeriesDetails`/a
 * página da Série continuam exatamente como sempre foram, intocadas.
 */
export function useEpisodeSeriesContext(seriesId: string, season: number) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["episode-series-context", seriesId, season, locale],
    queryFn: () => fetchEpisodeSeriesContext(seriesId, season, locale),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
