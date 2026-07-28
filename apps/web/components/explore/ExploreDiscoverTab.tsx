"use client";

import { useMemo } from "react";
import { useDiscoverList } from "@/lib/queries/discover";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
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
  const { t } = useTranslation();

  const continuing = useMemo(
    () => [...(popularSeries.data?.items.slice(0, 6) ?? []), ...(popularMovies.data?.items.slice(0, 6) ?? [])],
    [popularSeries.data, popularMovies.data]
  );

  return (
    <div className="pt-4">
      <DiscoverCarousel title={t("explore.discover.topSeriesForYou")} items={trendingSeries.data?.items ?? []} isLoading={trendingSeries.isLoading} />

      <DiscoverCarousel
        title={t("explore.discover.trendingSeries")}
        items={trendingSeries.data?.items ?? []}
        isLoading={trendingSeries.isLoading}
        viewAllHref="/explore/all-series"
        viewAllLabel={t("explore.discover.viewAllSeries")}
      />

      <DiscoverCarousel
        title={t("explore.discover.trendingMovies")}
        items={trendingMovies.data?.items ?? []}
        isLoading={trendingMovies.isLoading}
        viewAllHref="/explore/all-movies"
        viewAllLabel={t("explore.discover.viewAllMovies")}
      />

      <DiscoverCarousel title={t("explore.discover.upcomingMovies")} items={upcomingMovies.data?.items ?? []} isLoading={upcomingMovies.isLoading} />

      <DiscoverCarousel title={t("explore.discover.onTheAir")} items={onTheAir.data?.items ?? []} isLoading={onTheAir.isLoading} />

      <DiscoverCarousel title={t("explore.discover.keepExploring")} items={continuing} isLoading={popularSeries.isLoading || popularMovies.isLoading} />
    </div>
  );
}
