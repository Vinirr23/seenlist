"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Tv2, Clapperboard, Clock3, Film } from "lucide-react";
import { useProfileStats } from "@/lib/queries/profile-stats";
import { formatWatchDuration } from "@/lib/format-duration";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-054 ÔÇö substitui ProfileStatsGrid (removido) e o carrossel
 * StatsCarousel no Perfil (o componente continua existindo, s├│ que
 * agora s├│ ├® usado dentro da pr├│pria tela de estat├¡sticas). Um card
 * s├│, clic├ível, pr├®via de 4 n├║meros ÔÇö leva pra /profile/stats. Mesmo
 * hook de sempre (useProfileStats), nenhum c├ílculo novo.
 *
 * Redesign (a pedido) ÔÇö degrad├¬ douradoÔåÆverde-├ígua sutil (identidade
 * do app, n├úo a paleta roxa da refer├¬ncia trazida), um ├¡cone por
 * m├®trica, e "Ver detalhes" como p├¡lula preenchida em vez de s├│ a
 * seta ÔÇö mais convite a clicar, sem virar bot├úo de verdade dentro de
 * um Link (o card inteiro j├í ├® clic├ível).
 *
 * Tradu├º├úo (4┬║ lote) ÔÇö inclui o formatador de n├║mero, que segue o
 * idioma escolhido (`INTL_LOCALES`, mesmo racioc├¡nio de
 * ProfileHeader).
 */
export function StatisticsCard() {
  const { data: stats, isLoading, isError } = useProfileStats();
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(locale === "pt-BR" ? "pt-BR" : locale === "es" ? "es-ES" : "en-US");

  if (isLoading) {
    return <div className="mb-6 h-40 animate-pulse rounded-2xl bg-surface" />;
  }
  if (isError || !stats) {
    return (
      <div className="mb-6 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm text-muted">{t("stats.loadError")}</p>
      </div>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes, t);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes, t);

  const preview = [
    { label: t("stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched), icon: Tv2 },
    { label: t("stats.moviesWatched"), value: numberFormatter.format(stats.moviesCompleted), icon: Film },
    { label: t("stats.seriesTime"), value: seriesTime.primary, icon: Clock3 },
    { label: t("stats.movieTime"), value: movieTime.primary, icon: Clapperboard },
  ];

  return (
    <Link
      href="/profile/stats"
      className="mb-6 block overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/[0.14] via-surface to-secondary/[0.08] p-4 transition-colors hover:border-primary/40"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" strokeWidth={2} />
          <h2 className="text-sm font-semibold text-text">{t("stats.title")}</h2>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-background">
          {t("stats.seeDetails")}
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {preview.map((item) => (
          <div key={item.label} className="flex items-center gap-2.5">
            <item.icon className="h-4 w-4 shrink-0 text-secondary" strokeWidth={2} />
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-text">{item.value}</p>
              <p className="truncate text-xs text-muted">{item.label}</p>
            </div>
          </div>
        ))}
      </div>
    </Link>
  );
}
