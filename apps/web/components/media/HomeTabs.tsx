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
    <div
      role="tablist"
      className="relative mb-4 inline-flex rounded-full border border-white/10 p-1 backdrop-blur-[10px] backdrop-saturate-[160%]"
      style={{
        background: "radial-gradient(75% 100% at 14% 15%, rgba(255,255,255,0.13), transparent 60%), rgba(255,255,255,0.06)",
      }}
    >
      {/*
        * "Vidro" (mesmo padrão da aba ativa do Explorar, ExploreTabs.tsx)
        * — a cápsula deslizante virou a mesma pílula "gel" âmbar
        * (radial-gradient + sombras internas), em vez de `bg-primary`
        * chapado; o container ganhou vidro neutro (sem âmbar) igual à
        * aba inativa.
        *
        * TASK-063 (a pedido, 2026-08-26 — "diferenciar visualmente 'Em
        * breve'") — a cápsula muda de cor conforme a aba ativa: âmbar
        * pra "Minha Lista" (cor de sempre), azul pra "Em breve" — reforça
        * de cara "isso aqui é sobre o que ainda vai chegar", não sobre o
        * que já estou acompanhando. Como `HomeTabs` é compartilhado entre
        * Séries e Filmes (mesmos rótulos genéricos), a mudança vale pros
        * dois automaticamente — nenhuma prop nova precisou ser criada.
        */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full border border-white/15 transition-transform duration-300 ease-out"
        style={{
          transform: `translateX(${activeIndex * 100}%)`,
          background:
            active === "em-breve"
              ? "radial-gradient(130% 170% at 28% 18%, rgba(90,165,235,0.9) 0%, rgba(58,133,206,0.88) 42%, rgba(24,78,140,0.92) 100%)"
              : "radial-gradient(130% 170% at 28% 18%, rgba(240,169,79,0.88) 0%, rgba(232,163,61,0.85) 42%, rgba(176,95,27,0.9) 100%)",
          boxShadow:
            active === "em-breve"
              ? "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(10,50,90,0.4)"
              : "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -4px 7px rgba(120,66,10,0.4)",
        }}
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
