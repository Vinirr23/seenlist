"use client";

import { LayoutGrid, List } from "lucide-react";
import type { ViewMode } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface ViewModeToggleProps {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ viewMode, onChange }: ViewModeToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex gap-1 rounded-lg border border-border p-0.5">
      <button
        type="button"
        aria-label={t("media.viewAsGrid")}
        aria-pressed={viewMode === "grid"}
        onClick={() => onChange("grid")}
        className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-surface text-primary" : "text-muted"}`}
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={t("media.viewAsList")}
        aria-pressed={viewMode === "list"}
        onClick={() => onChange("list")}
        className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-surface text-primary" : "text-muted"}`}
      >
        <List className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
