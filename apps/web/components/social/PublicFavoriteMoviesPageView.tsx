"use client";

import { notFound } from "next/navigation";
import { usePublicProfile } from "@/lib/queries/public-profile";
import { SectionPageHeader } from "@/components/profile/SectionPageHeader";
import { PageError } from "@/components/media/PageError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { PublicFavoritesLibraryView } from "./PublicFavoritesLibraryView";

/** Sub-página "ver mais" de "Filmes favoritos" no perfil público (`/u/[username]/favorite-movies`). */
export function PublicFavoriteMoviesPageView({ username }: { username: string }) {
  const { data: profile, isLoading, isError, refetch } = usePublicProfile(username);
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
        <div className="h-8 w-40 animate-pulse rounded bg-surface" />
      </div>
    );
  }

  if (isError) {
    return <PageError message={t("social.errorLoadProfile")} onRetry={() => refetch()} />;
  }

  if (!profile) {
    notFound();
  }

  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title={t("profile.section.favoriteMovies")} backHref={`/u/${username}`} />
      <PublicFavoritesLibraryView userId={profile.userId} mediaType="movie" viewModeScope="public-favorite-movies" />
    </div>
  );
}
