import { FilteredSeriesListScreen } from "@/components/media/FilteredSeriesListScreen";

export default function PausedScreen() {
  return (
    <FilteredSeriesListScreen
      status="paused"
      titleKey="seriesHome.pausedTitle"
      emptyMessageKey="seriesHome.pausedEmpty"
    />
  );
}
