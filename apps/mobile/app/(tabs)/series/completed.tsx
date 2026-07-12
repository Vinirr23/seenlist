import { FilteredSeriesListScreen } from "@/components/media/FilteredSeriesListScreen";

export default function CompletedScreen() {
  return (
    <FilteredSeriesListScreen
      status="completed"
      title="Concluídas"
      emptyMessage="Nenhuma série concluída por aqui."
    />
  );
}
