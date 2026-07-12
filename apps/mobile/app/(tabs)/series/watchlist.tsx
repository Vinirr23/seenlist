import { FilteredSeriesListScreen } from "@/components/media/FilteredSeriesListScreen";

export default function WatchlistScreen() {
  return (
    <FilteredSeriesListScreen
      status="want_to_watch"
      title="Assistir depois"
      emptyMessage="Sua lista está vazia."
    />
  );
}
