import { FilteredSeriesListScreen } from "@/components/media/FilteredSeriesListScreen";

export default function WatchlistScreen() {
  return (
    <FilteredSeriesListScreen
      status="want_to_watch"
      titleKey="seriesHome.watchlistTitle"
      emptyMessageKey="seriesHome.watchlistEmpty"
    />
  );
}
