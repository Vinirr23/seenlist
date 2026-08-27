"use client";

import { Sparkles, PartyPopper } from "lucide-react";
import type { SeriesCaughtUpBadge } from "@/lib/seriesCaughtUpBadge";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-170 — cores emprestadas direto de `SERIES_CATEGORIES`
 * (`lib/series-categories.ts`): azul = "Em dia", verde = "Assistidas"
 * — mesma linguagem visual da Biblioteca, não uma cor nova inventada
 * pra essa tela específica.
 */
export function SeriesCaughtUpCard({ badge }: { badge: Exclude<SeriesCaughtUpBadge, null> }) {
  const { t } = useTranslation();

  if (badge === "ongoing") {
    return (
      // "Vidro" (toque leve — mantém o tom azul do aviso, ganha blur/saturação)
      <div className="flex items-center gap-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-3.5 backdrop-blur-[14px] backdrop-saturate-[160%]">
        <Sparkles className="h-5 w-5 shrink-0 text-blue-400" strokeWidth={2} />
        <div>
          <p className="text-sm font-semibold text-text">{t("series.youAreCaughtUp")}</p>
          <p className="text-xs text-muted">{t("series.moreEpisodesOnTheWay")}</p>
        </div>
      </div>
    );
  }

  return (
    // "Vidro" (toque leve — mantém o tom verde do aviso, ganha blur/saturação)
    <div className="flex items-center gap-3 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3.5 backdrop-blur-[14px] backdrop-saturate-[160%]">
      <PartyPopper className="h-5 w-5 shrink-0 text-green-400" strokeWidth={2} />
      <div>
        <p className="text-sm font-semibold text-text">{t("series.seriesEnded")}</p>
        <p className="text-xs text-muted">{t("series.watchedEverything")}</p>
      </div>
    </div>
  );
}
