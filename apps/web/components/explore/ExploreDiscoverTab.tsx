"use client";

import { useMemo } from "react";
import { useDiscoverList } from "@/lib/queries/discover";
import { useLibraryItems } from "@/lib/queries/library";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { DiscoverCarousel } from "./DiscoverCarousel";
import type { DiscoverItem } from "@/lib/tmdb/client";

/**
 * TASK-058 — "Principais séries pra você" não tem sistema de
 * recomendação personalizado no projeto ainda — usar trending como
 * aproximação é honesto (dado real do TMDB), diferente de inventar
 * um ranking "personalizado" que na verdade não seria.
 *
 * CORREÇÃO (a pedido — "por que fica aparecendo coisa que já está
 * marcada?") — todo carrossel de Descobrir agora filtra fora
 * qualquer título que já esteja na Biblioteca do usuário (qualquer
 * status — assistindo, quero assistir, concluído). Faz sentido pra
 * uma tela de DESCOBERTA: não tem por que sugerir de novo algo que a
 * pessoa já tem. Reaproveita `useLibraryItems` (mesma consulta da
 * Home/Biblioteca, já em cache — não dispara busca nova).
 */
function useFilterOutLibraryItems(items: DiscoverItem[] | undefined): DiscoverItem[] {
  const { data: libraryItems } = useLibraryItems();

  const libraryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of libraryItems ?? []) {
      keys.add(`${item.mediaType}:${item.id}`);
    }
    return keys;
  }, [libraryItems]);

  return useMemo(() => (items ?? []).filter((item) => !libraryKeys.has(`${item.mediaType}:${item.id}`)), [items, libraryKeys]);
}

export function ExploreDiscoverTab() {
  const trendingSeries = useDiscoverList("trending_series");
  const trendingMovies = useDiscoverList("trending_movies");
  const upcomingMovies = useDiscoverList("upcoming_movies");
  const onTheAir = useDiscoverList("on_the_air_series");
  const popularSeries = useDiscoverList("popular_series");
  const popularMovies = useDiscoverList("popular_movies");
  const { t } = useTranslation();

  const trendingSeriesFiltered = useFilterOutLibraryItems(trendingSeries.data?.items);
  const trendingMoviesFiltered = useFilterOutLibraryItems(trendingMovies.data?.items);
  const upcomingMoviesFiltered = useFilterOutLibraryItems(upcomingMovies.data?.items);
  const onTheAirFiltered = useFilterOutLibraryItems(onTheAir.data?.items);
  const popularSeriesFiltered = useFilterOutLibraryItems(popularSeries.data?.items);
  const popularMoviesFiltered = useFilterOutLibraryItems(popularMovies.data?.items);

  const continuing = useMemo(
    () => [...popularSeriesFiltered.slice(0, 6), ...popularMoviesFiltered.slice(0, 6)],
    [popularSeriesFiltered, popularMoviesFiltered]
  );

  return (
    <div className="pt-4">
      <DiscoverCarousel title={t("explore.discover.topSeriesForYou")} items={trendingSeriesFiltered} isLoading={trendingSeries.isLoading} />

      <DiscoverCarousel
        title={t("explore.discover.trendingSeries")}
        items={trendingSeriesFiltered}
        isLoading={trendingSeries.isLoading}
        viewAllHref="/explore/all-series"
        viewAllLabel={t("explore.discover.viewAllSeries")}
      />

      <DiscoverCarousel
        title={t("explore.discover.trendingMovies")}
        items={trendingMoviesFiltered}
        isLoading={trendingMovies.isLoading}
        viewAllHref="/explore/all-movies"
        viewAllLabel={t("explore.discover.viewAllMovies")}
      />

      <DiscoverCarousel title={t("explore.discover.upcomingMovies")} items={upcomingMoviesFiltered} isLoading={upcomingMovies.isLoading} />

      <DiscoverCarousel title={t("explore.discover.onTheAir")} items={onTheAirFiltered} isLoading={onTheAir.isLoading} />

      <DiscoverCarousel title={t("explore.discover.keepExploring")} items={continuing} isLoading={popularSeries.isLoading || popularMovies.isLoading} />
    </div>
  );
}
