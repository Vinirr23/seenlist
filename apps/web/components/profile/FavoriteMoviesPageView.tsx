import { SectionPageHeader } from "./SectionPageHeader";
import { FavoritesLibraryView } from "./FavoritesLibraryView";

export function FavoriteMoviesPageView() {
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title="Filmes favoritos" />
      <FavoritesLibraryView mediaType="movie" viewModeScope="profile-favorite-movies" />
    </div>
  );
}
