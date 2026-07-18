import { Sparkles, PartyPopper } from "lucide-react";
import type { SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";

/**
 * TASK-170 — cores emprestadas direto de `SERIES_CATEGORIES`
 * (`lib/series-categories.ts`): azul = "Em dia", verde = "Assistidas"
 * — mesma linguagem visual da Biblioteca, não uma cor nova inventada
 * pra essa tela específica.
 */
export function SeriesCaughtUpCard({ badge }: { badge: Exclude<SeriesCaughtUpBadge, null> }) {
  if (badge === "ongoing") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3.5">
        <Sparkles className="h-5 w-5 shrink-0 text-blue-400" strokeWidth={2} />
        <div>
          <p className="text-sm font-semibold text-text">Você está em dia!</p>
          <p className="text-xs text-muted">Mais episódios a caminho.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3.5">
      <PartyPopper className="h-5 w-5 shrink-0 text-green-400" strokeWidth={2} />
      <div>
        <p className="text-sm font-semibold text-text">Série encerrada</p>
        <p className="text-xs text-muted">Você assistiu tudo — não vem mais episódio novo por aí.</p>
      </div>
    </div>
  );
}
