"use client";

import { Tv, Star, Clapperboard } from "lucide-react";
import { useCurrentUser } from "@/lib/queries/current-user";
import { useSeriesActivityIds, useMovieActivityIds, useFavoriteIds } from "@/lib/queries/profile-media-carousel";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ProfileMediaCarousel } from "./ProfileMediaCarousel";
import { ProfileRecommendationsPreview } from "./ProfileRecommendationsPreview";
import { ProfileListsPreview } from "./ProfileListsPreview";

/**
 * TASK-177 (redesign, a pedido — referências de outros apps trazidas
 * pelo usuário) — "Séries"/"Filmes"/"Séries favoritas"/"Filmes
 * favoritos" deixaram de ser só uma linha com número: agora mostram
 * um carrossel de pôster de verdade, ordenado por atividade mais
 * recente, com rolagem infinita.
 *
 * TASK-178 — "Recomendações"/"Minhas listas" também ganharam prévia
 * visual de verdade (avatar de quem recomendou + pôster do baralho
 * de cada lista), em vez de só "0 >" — ver `ProfileRecommendationsPreview.tsx`/`ProfileListsPreview.tsx`.
 */
export function ProfileSectionsList() {
  const { data: user } = useCurrentUser();
  const { t } = useTranslation();

  const seriesIds = useSeriesActivityIds(user?.id ?? null);
  const movieIds = useMovieActivityIds(user?.id ?? null);
  const favoriteSeriesIds = useFavoriteIds(user?.id ?? null, "series");
  const favoriteMovieIds = useFavoriteIds(user?.id ?? null, "movie");

  return (
    <div className="mb-2">
      <section className="mb-6">
        <ProfileRecommendationsPreview />
      </section>

      <ProfileListsPreview />

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
