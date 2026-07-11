"use client";

import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { formatWatchDuration } from "@/lib/format-duration";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-054 — substitui ProfileStatsGrid (removido) e o carrossel
 * StatsCarousel no Perfil (o componente continua existindo, só que
 * agora só é usado dentro da própria tela de estatísticas). Um card
 * só, clicável, prévia de 4 números — leva pra /profile/stats. Mesmo
 * hook de sempre (useProfileStats), nenhum cálculo novo.
 *
 * Tradução (4º lote) — inclui o formatador de número, que segue o
 * idioma escolhido (`INTL_LOCALES`, mesmo raciocínio de
 * ProfileHeader).
 */
export function StatisticsCard() {
  const { data: stats, isLoading, isError } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US");

  if (isLoading) {
    return <div className="mb-6 h-32 animate-pulse rounded-2xl bg-surface" />;
  }
  if (isError || !stats) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t("stats.loadError")}</p>
      </div>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes);

  const preview = [
    { label: t("stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched) },
    { label: t("stats.moviesWatched"), value: numberFormatter.format(stats.moviesCompleted) },
    { label: t("stats.seriesTime"), value: seriesTime.primary },
    { label: t("stats.movieTime"), value: movieTime.primary },
  ];

  return (
    <Link
      href="/profile/stats"
      className="mb-6 block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-primary/40"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-text">{t("stats.title")}</h2>
        </div>
        <ChevronRight className="h-4 w-4 text-muted" strokeWidth={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {preview.map((item) => (
          <div key={item.label}>
            <p className="text-lg font-bold text-text">{item.value}</p>
            <p className="text-xs text-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </Link>
  );
}
