"use client";

import { SectionPageHeader } from "./SectionPageHeader";
import { FavoritesLibraryView } from "./FavoritesLibraryView";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function FavoriteMoviesPageView() {
  const { t } = useTranslation();
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title={t("profile.section.favoriteMovies")} />
      <FavoritesLibraryView mediaType="movie" viewModeScope="profile-favorite-movies" />
    </div>
  );
}
