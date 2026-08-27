"use client";

import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

// Reformulação da aba Explorar (2026-08-21) — "Descobrir" (misturava
// séries e filmes) virou 2 abas dedicadas: "movies" e "series".
export type ExploreTab = "movies" | "series" | "activity";

const TABS: { key: ExploreTab; labelKey: string }[] = [
  { key: "movies", labelKey: "explore.tab.movies" },
  { key: "series", labelKey: "explore.tab.series" },
  { key: "activity", labelKey: "explore.tab.activity" },
];

/**
 * Correção (a pedido — "deixe todos os botões padrão, igual 'ver
 * detalhes'") — a aba ativa era um retângulo âmbar chapado
 * (`bg-primary`, sem vidro nenhum); virou a mesma pílula "gel" do
 * "Ver detalhes" (StatisticsCard.tsx). A aba inativa (antes
 * `bg-surface`, sólida) ganhou o mesmo tratamento de vidro neutro (sem
 * âmbar) do resto da tela, pra não destoar ao lado da ativa.
 */
export function ExploreTabs({ active, onChange }: { active: ExploreTab; onChange: (tab: ExploreTab) => void }) {
  const { t } = useTranslation();

  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto overflow-y-hidden px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wide backdrop-blur-[10px] backdrop-saturate-[160%] transition-colors",
              isActive ? "border-white/15 text-background" : "border-white/10 text-muted"
            )}
            style={
              isActive
                ? {
                    background:
                      "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
                  }
                : {
                    background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
                  }
            }
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
