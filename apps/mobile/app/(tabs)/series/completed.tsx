import { FilteredSeriesListScreen } from "@/components/media/FilteredSeriesListScreen";

export default function CompletedScreen() {
  return (
    <FilteredSeriesListScreen
      status="completed"
      titleKey="seriesHome.completedTitle"
      emptyMessageKey="seriesHome.completedEmpty"
    />
  );
}
