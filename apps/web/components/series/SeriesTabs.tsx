"use client";

import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export type SeriesTab = "sobre" | "episodios";

const TAB_LABEL_KEYS: Record<SeriesTab, string> = {
  sobre: "tab.about",
  episodios: "series.episodesLabel",
};

export function SeriesTabs({
  active,
  onChange,
}: {
  active: SeriesTab;
  onChange: (tab: SeriesTab) => void;
}) {
  const { t } = useTranslation();

  return (
    <div role="tablist" className="flex gap-1 border-b border-border px-4">
      {(Object.keys(TAB_LABEL_KEYS) as SeriesTab[]).map((tab) => (
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
          {t(TAB_LABEL_KEYS[tab])}
        </button>
      ))}
    </div>
  );
}
