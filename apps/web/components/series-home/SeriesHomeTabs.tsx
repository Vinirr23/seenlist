"use client";

import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export type SeriesHomeTab = "minha-lista" | "em-breve";

const ORDER: SeriesHomeTab[] = ["minha-lista", "em-breve"];

export function SeriesHomeTabs({
  active,
  onChange,
}: {
  active: SeriesHomeTab;
  onChange: (tab: SeriesHomeTab) => void;
}) {
  const { t } = useTranslation();
  const LABELS: Record<SeriesHomeTab, string> = {
    "minha-lista": t("seriesHome.tab.myList"),
    "em-breve": t("seriesHome.tab.upcoming"),
  };
  return (
    <div role="tablist" className="mb-4 flex gap-1 border-b border-border">
      {ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "border-b-2 px-3 py-2.5 text-xs font-bold uppercase tracking-wide transition-colors",
            active === tab ? "border-primary text-text" : "border-transparent text-muted"
          )}
        >
          {LABELS[tab]}
        </button>
      ))}
    </div>
  );
}
