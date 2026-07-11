"use client";

import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export type ExploreTab = "discover" | "activity";

const TABS: { key: ExploreTab; labelKey: string }[] = [
  { key: "discover", labelKey: "explore.tab.discover" },
  { key: "activity", labelKey: "explore.tab.activity" },
];

export function ExploreTabs({ active, onChange }: { active: ExploreTab; onChange: (tab: ExploreTab) => void }) {
  const { t } = useTranslation();

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={cn(
            "shrink-0 rounded-full px-4 py-2 text-xs font-bold tracking-wide transition-colors",
            active === tab.key ? "bg-primary text-background" : "bg-surface text-muted"
          )}
        >
          {t(tab.labelKey)}
        </button>
      ))}
    </div>
  );
}
