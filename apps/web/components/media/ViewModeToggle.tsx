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
    // "Vidro" (mesmo padrão dos chips neutros do Explorar) — container com borda clara + blur/saturação em vez de `border-border` sólida; estado ativo ganha um tom âmbar suave em vez de `bg-surface`.
    <div
      className="flex gap-1 rounded-lg border border-white/10 p-0.5 backdrop-blur-[10px] backdrop-saturate-[160%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
      }}
    >
      <button
        type="button"
        aria-label={t("media.viewAsGrid")}
        aria-pressed={viewMode === "grid"}
        onClick={() => onChange("grid")}
        className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-primary/20 text-primary" : "text-muted"}`}
      >
        <LayoutGrid className="h-4 w-4" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label={t("media.viewAsList")}
        aria-pressed={viewMode === "list"}
        onClick={() => onChange("list")}
        className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-primary/20 text-primary" : "text-muted"}`}
      >
        <List className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
