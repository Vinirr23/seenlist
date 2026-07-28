"use client";

import { Film, Tv, CheckCircle2, ListVideo } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { StatCard } from "./StatCard";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

/**
 * Ajuste — virou carrossel horizontal, mesmo padrão visual e mesmo
 * componente (`StatCard`) já usados por `StatsCarousel` (scroll
 * suave, snap, mesma largura/altura de card, scrollbar escondida).
 * Nenhum valor, cálculo ou consulta mudou — só a apresentação:
 * `useProfileStats()` é o mesmo hook de sempre, sem nenhuma
 * alteração.
 */
export function ProfileStatsGrid() {
  const { data: stats, isLoading, isError } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading) {
    return (
      <div
        className="-mx-4 mb-6 flex gap-3 overflow-hidden px-4"
        aria-busy="true"
        aria-label={t("profile.loadingStats")}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 w-40 shrink-0 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return <p className="mb-6 text-sm text-muted">{t("profile.errorLoadStats")}</p>;
  }

  const cards = [
    { icon: Film, key: "moviesInLibrary", title: t("profile.stats.moviesInLibrary"), value: numberFormatter.format(stats.moviesInLibrary) },
    { icon: Tv, key: "seriesInLibrary", title: t("profile.stats.seriesInLibrary"), value: numberFormatter.format(stats.seriesInLibrary) },
    { icon: CheckCircle2, key: "moviesCompleted", title: t("profile.stats.moviesCompleted"), value: numberFormatter.format(stats.moviesCompleted) },
    { icon: CheckCircle2, key: "seriesCompleted", title: t("profile.stats.seriesCompleted"), value: numberFormatter.format(stats.seriesCompleted) },
    { icon: ListVideo, key: "episodesWatched", title: t("profile.stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched) },
  ];

  return (
    <div className="mb-6">
      <div
        className={
          "-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 snap-x snap-mandatory " +
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {cards.map((card) => (
          <StatCard key={card.key} icon={card.icon} title={card.title} value={card.value} />
        ))}
      </div>
    </div>
  );
}
