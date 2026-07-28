"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@seenlist/utils";
import { StatsSeriesTab } from "./StatsSeriesTab";
import { StatsMoviesTab } from "./StatsMoviesTab";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

type StatsTab = "series" | "movies";

/**
 * TASK-054 — tela dedicada de estatísticas, header simples + abas
 * Séries/Filmes, layout inspirado no TV Time. Cada aba é seu próprio
 * componente (StatsSeriesTab/StatsMoviesTab) — só reorganização,
 * nenhum cálculo novo além dos explicitamente documentados nesses
 * dois arquivos.
 */
export function StatsPageView() {
  const [tab, setTab] = useState<StatsTab>("series");
  const { t } = useTranslation();

  return (
    <div className="w-full pb-24 md:mx-auto md:max-w-[430px]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <Link href="/profile" aria-label={t("common.back")} className="text-text">
          <ArrowLeft className="h-5 w-5" strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-bold text-text">{t("profile.statistics")}</h1>
      </div>

      <div className="mt-4 flex border-b border-border px-4">
        <button
          type="button"
          onClick={() => setTab("series")}
          className={cn(
            "flex-1 border-b-2 pb-2 text-sm font-medium transition-colors",
            tab === "series" ? "border-primary text-text" : "border-transparent text-muted"
          )}
        >
          {t("nav.series")}
        </button>
        <button
          type="button"
          onClick={() => setTab("movies")}
          className={cn(
            "flex-1 border-b-2 pb-2 text-sm font-medium transition-colors",
            tab === "movies" ? "border-primary text-text" : "border-transparent text-muted"
          )}
        >
          {t("nav.movies")}
        </button>
      </div>

      <div className="px-4 pt-4">{tab === "series" ? <StatsSeriesTab /> : <StatsMoviesTab />}</div>
    </div>
  );
}
