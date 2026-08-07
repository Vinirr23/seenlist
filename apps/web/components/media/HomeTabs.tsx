"use client";

import { cn } from "@seenlist/utils";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-020: generalizado — era `SeriesHomeTabs` (só usado pela aba
 * Séries). Renomeado pra `HomeTabs` e movido pra `components/media/`
 * porque a aba Filmes usa exatamente o mesmo componente agora — os
 * rótulos já eram genéricos ("Minha Lista" / "Em breve"), não
 * precisou mudar nada além do nome/local.
 *
 * A PEDIDO — trocado de sublinhado por trilha com cápsula deslizante,
 * mesmo padrão da barra de navegação principal
 * (`BottomNavigation.tsx`) — escolhido de propósito pela
 * consistência: o mesmo gesto visual em dois lugares do app, não
 * dois comportamentos diferentes. Aqui, diferente do mobile, a
 * cápsula usa PORCENTAGEM em `translateX` sem problema nenhum — a
 * limitação real (transform com string de porcentagem não confiável)
 * é específica do motor do React Native, não existe em CSS normal.
 */
export type HomeTab = "minha-lista" | "em-breve";

const ORDER: HomeTab[] = ["minha-lista", "em-breve"];

export function HomeTabs({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
  const { t } = useTranslation();
  const labels: Record<HomeTab, string> = {
    "minha-lista": t("seriesHome.tab.myList"),
    "em-breve": t("seriesHome.tab.upcoming"),
  };
  const activeIndex = ORDER.indexOf(active);

  return (
    <div role="tablist" className="relative mb-4 inline-flex rounded-full border border-border bg-surface p-1">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full bg-primary transition-transform duration-300 ease-out"
        style={{ transform: `translateX(${activeIndex * 100}%)` }}
      />
      {ORDER.map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={active === tab}
          onClick={() => onChange(tab)}
          className={cn(
            "relative z-10 rounded-full px-4 py-1.5 text-xs font-bold transition-colors",
            active === tab ? "text-background" : "text-muted"
          )}
        >
          {labels[tab]}
        </button>
      ))}
    </div>
  );
}
