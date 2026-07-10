"use client";

import { cn } from "@seenlist/utils";

export type ExploreTab = "feed" | "discover" | "activity";

const TABS: { key: ExploreTab; label: string }[] = [
  { key: "feed", label: "FEED" },
  { key: "discover", label: "DESCOBRIR" },
  { key: "activity", label: "ATIVIDADE" },
];

export function ExploreTabs({ active, onChange }: { active: ExploreTab; onChange: (tab: ExploreTab) => void }) {
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
          {tab.label}
        </button>
      ))}
    </div>
  );
}
