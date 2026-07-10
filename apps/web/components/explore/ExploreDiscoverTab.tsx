"use client";

import { useMemo } from "react";
import { useDiscoverList } from "@/lib/queries/discover";
import { DiscoverCarousel } from "./DiscoverCarousel";

/**
 * TASK-058 — "Principais séries pra você" não tem sistema de
 * recomendação personalizado no projeto ainda — usar trending como
 * aproximação é honesto (dado real do TMDB), diferente de inventar
 * um ranking "personalizado" que na verdade não seria.
 */
export function ExploreDiscoverTab() {
  const trendingSeries = useDiscoverList("trending_series");
  const trendingMovies = useDiscoverList("trending_movies");
  const upcomingMovies = useDiscoverList("upcoming_movies");
  const onTheAir = useDiscoverList("on_the_air_series");
  const popularSeries = useDiscoverList("popular_series");
  const popularMovies = useDiscoverList("popular_movies");

  const continuing = useMemo(
    () => [...(popularSeries.data?.items.slice(0, 6) ?? []), ...(popularMovies.data?.items.slice(0, 6) ?? [])],
    [popularSeries.data, popularMovies.data]
  );

  return (
    <div className="pt-4">
      <DiscoverCarousel title="Principais séries para você" items={trendingSeries.data?.items ?? []} isLoading={trendingSeries.isLoading} />

      <DiscoverCarousel
        title="Séries em alta"
        items={trendingSeries.data?.items ?? []}
        isLoading={trendingSeries.isLoading}
        viewAllHref="/explore/all-series"
        viewAllLabel="Ver todas as séries"
      />

      <DiscoverCarousel
        title="Filmes em alta"
        items={trendingMovies.data?.items ?? []}
        isLoading={trendingMovies.isLoading}
        viewAllHref="/explore/all-movies"
        viewAllLabel="Ver todos os filmes"
      />

      <DiscoverCarousel title="Lançamentos recentes" items={upcomingMovies.data?.items ?? []} isLoading={upcomingMovies.isLoading} />

      <DiscoverCarousel title="Em breve" items={onTheAir.data?.items ?? []} isLoading={onTheAir.isLoading} />

      <DiscoverCarousel title="Continuar explorando" items={continuing} isLoading={popularSeries.isLoading || popularMovies.isLoading} />
    </div>
  );
}
