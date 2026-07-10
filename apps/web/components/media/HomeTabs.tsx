import { cn } from "@seenlist/utils";

/**
 * TASK-020: generalizado — era `SeriesHomeTabs` (só usado pela aba
 * Séries). Renomeado pra `HomeTabs` e movido pra `components/media/`
 * porque a aba Filmes usa exatamente o mesmo componente agora — os
 * rótulos já eram genéricos ("Minha Lista" / "Em breve"), não
 * precisou mudar nada além do nome/local.
 */
export type HomeTab = "minha-lista" | "em-breve";

const LABELS: Record<HomeTab, string> = {
  "minha-lista": "Minha Lista",
  "em-breve": "Em breve",
};

const ORDER: HomeTab[] = ["minha-lista", "em-breve"];

export function HomeTabs({ active, onChange }: { active: HomeTab; onChange: (tab: HomeTab) => void }) {
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
