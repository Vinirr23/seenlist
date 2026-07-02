import { cn } from "@seenlist/utils";

export type SeriesTab = "sobre" | "episodios";

const TAB_LABELS: Record<SeriesTab, string> = {
  sobre: "Sobre",
  episodios: "Episódios",
};

export function SeriesTabs({
  active,
  onChange,
}: {
  active: SeriesTab;
  onChange: (tab: SeriesTab) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border px-4">
      {(Object.keys(TAB_LABELS) as SeriesTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            active === tab ? "border-primary text-text" : "border-transparent text-muted"
          )}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
