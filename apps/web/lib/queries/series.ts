import { useQuery } from "@tanstack/react-query";
import type { SeriesDetails } from "@seenlist/types";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

async function fetchSeriesDetails(seriesId: string, language: string): Promise<SeriesDetails> {
  const response = await fetch(`/api/tmdb/series/${seriesId}?language=${language}`);
  if (!response.ok) {
    throw new Error("series details fetch failed");
  }
  return response.json() as Promise<SeriesDetails>;
}

/** A PEDIDO — título/sinopse/elenco/gênero sempre vinham em português, mesmo com o app noutro idioma. `locale` na `queryKey` garante que trocar de idioma busca de novo, não fica com o cache antigo. */
export function useSeriesDetails(seriesId: string) {
  const { locale } = useTranslation();
  return useQuery({
    queryKey: ["series", seriesId, locale],
    queryFn: () => fetchSeriesDetails(seriesId, locale),
    staleTime: FIVE_MINUTES_MS,
    gcTime: FIVE_MINUTES_MS,
  });
}
