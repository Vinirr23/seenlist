import { FilteredSeriesListScreen } from "@/components/media/FilteredSeriesListScreen";

export default function PausedScreen() {
  return (
    <FilteredSeriesListScreen
      status="paused"
      title="Interrompidas"
      emptyMessage="Nenhuma série interrompida por aqui."
    />
  );
}
