"use client";

import { ListChecks, Tv, Star, Clapperboard, Send } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useProfileSectionCounts } from "@/lib/queries/profile-section-counts";
import { useSeriesActivityIds, useMovieActivityIds, useFavoriteIds } from "@/lib/queries/profile-media-carousel";
import { useUnreadRecommendationsCount } from "@/lib/queries/recommendations";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ProfileSectionRow } from "./ProfileSectionRow";
import { ProfileMediaCarousel } from "./ProfileMediaCarousel";

/**
 * TASK-177 (redesign, a pedido — referências de outros apps trazidas
 * pelo usuário) — "Séries"/"Filmes"/"Séries favoritas"/"Filmes
 * favoritos" deixaram de ser só uma linha com número: agora mostram
 * um carrossel de pôster de verdade, ordenado por atividade mais
 * recente, com rolagem infinita. "Recomendações"/"Minhas listas"
 * continuam como linha simples — recomendação é sobre pessoas, lista
 * é uma coisa mais abstrata, nenhum dos dois ganha muito virando
 * carrossel de pôster.
 */
export function ProfileSectionsList() {
  const { data: user } = useCurrentUser();
  const { data: counts } = useProfileSectionCounts(user?.id ?? null);
  const { data: unreadRecommendations } = useUnreadRecommendationsCount();
  const { t } = useTranslation();

  const seriesIds = useSeriesActivityIds(user?.id ?? null);
  const movieIds = useMovieActivityIds(user?.id ?? null);
  const favoriteSeriesIds = useFavoriteIds(user?.id ?? null, "series");
  const favoriteMovieIds = useFavoriteIds(user?.id ?? null, "movie");

  return (
    <div className="mb-2">
      <section className="mb-6 space-y-2">
        <ProfileSectionRow
          icon={Send}
          label="Recomendações"
          count={unreadRecommendations}
          href="/profile/recommendations"
        />
        <ProfileSectionRow icon={ListChecks} label={t("profile.section.lists")} count={counts?.lists} href="/profile/lists" />
      </section>

      <ProfileMediaCarousel
        icon={Tv}
        label={t("nav.series")}
        href="/profile/series"
        mediaType="series"
        ids={seriesIds.data ?? []}
        isLoadingIds={seriesIds.isLoading}
      />

      <ProfileMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteSeries")}
        href="/profile/favorite-series"
        mediaType="series"
        ids={favoriteSeriesIds.data ?? []}
        isLoadingIds={favoriteSeriesIds.isLoading}
        emptyLabel={t("profile.section.addFavoriteSeries")}
        emptyHref="/profile/series"
      />

      <ProfileMediaCarousel
        icon={Clapperboard}
        label={t("nav.movies")}
        href="/profile/movies"
        mediaType="movie"
        ids={movieIds.data ?? []}
        isLoadingIds={movieIds.isLoading}
      />

      <ProfileMediaCarousel
        icon={Star}
        label={t("profile.section.favoriteMovies")}
        href="/profile/favorite-movies"
        mediaType="movie"
        ids={favoriteMovieIds.data ?? []}
        isLoadingIds={favoriteMovieIds.isLoading}
        emptyLabel={t("profile.section.addFavoriteMovies")}
        emptyHref="/profile/movies"
      />
    </div>
  );
}
