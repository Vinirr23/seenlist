import { SectionPageHeader } from "./SectionPageHeader";
import { FavoritesLibraryView } from "./FavoritesLibraryView";

export function FavoriteSeriesPageView() {
  return (
    <div className="w-full px-4 pb-24 pt-4 md:mx-auto md:max-w-[430px]">
      <SectionPageHeader title="Séries favoritas" />
      <FavoritesLibraryView mediaType="series" viewModeScope="profile-favorite-series" />
    </div>
  );
}
