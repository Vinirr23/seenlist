"use client";

import { Clock, ListVideo, Film, CheckCircle2, Tv } from "lucide-react";
import { useProfileStats, type ProfileStats } from "@/lib/queries/profile-stats";
import { formatWatchDuration } from "@/lib/format-duration";
import { StatCard } from "./StatCard";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { INTL_LOCALES } from "@/lib/i18n/translations";

export interface StatsCarouselProps {
  stats: ProfileStats | undefined;
  isLoading: boolean;
  isError: boolean;
  /** Perfil próprio mostra "Não foi possível carregar suas..."; perfil público mostra "as estatísticas deste perfil". */
  ownerLabel?: "own" | "other";
}

/**
 * TASK-028, item 5 — vira componente puro (recebe os dados prontos)
 * em vez de buscar sozinho, pra poder ser reaproveitado pelo perfil
 * público (`usePublicStats`) sem duplicar o carrossel inteiro. A
 * lista de 8 cards agora bate exatamente com o que o item 5 pede —
 * antes tinha um conjunto um pouco diferente (série pausada, assistir
 * depois); trocado pra "séries/filmes na biblioteca" e "filmes
 * concluídos", como pedido explicitamente aqui.
 */
export function StatsCarousel({ stats, isLoading, isError, ownerLabel = "own" }: StatsCarouselProps) {
  const { t, locale } = useTranslation();
  const numberFormatter = new Intl.NumberFormat(INTL_LOCALES[locale]);

  if (isLoading) {
    return (
      <section className="mb-6">
        <h2 className="mb-3 px-1 text-lg font-bold text-text">{t("profile.statistics")}</h2>
        <div className="flex gap-3 overflow-hidden" aria-busy="true" aria-label={t("profile.loadingStats")}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-32 w-40 shrink-0 animate-pulse rounded-2xl bg-surface" />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !stats) {
    return (
      <section className="mb-6">
        <h2 className="mb-3 px-1 text-lg font-bold text-text">{t("profile.statistics")}</h2>
        <p className="text-sm text-muted">
          {ownerLabel === "own" ? t("profile.errorLoadStats") : t("profile.errorLoadStatsOther")}
        </p>
      </section>
    );
  }

  const seriesTime = formatWatchDuration(stats.seriesWatchMinutes, t);
  const movieTime = formatWatchDuration(stats.movieWatchMinutes, t);

  const cards = [
    { icon: Clock, key: "seriesTime", title: t("profile.stats.timeWatchingSeries"), value: seriesTime.primary, subtext: seriesTime.secondary },
    { icon: ListVideo, key: "episodesWatched", title: t("profile.stats.episodesWatched"), value: numberFormatter.format(stats.episodesWatched) },
    { icon: Film, key: "movieTime", title: t("profile.stats.timeWatchingMovies"), value: movieTime.primary, subtext: movieTime.secondary },
    { icon: CheckCircle2, key: "moviesCompleted", title: t("profile.stats.moviesCompleted"), value: numberFormatter.format(stats.moviesCompleted) },
    { icon: CheckCircle2, key: "seriesCompleted", title: t("profile.stats.seriesCompleted"), value: numberFormatter.format(stats.seriesCompleted) },
    { icon: Tv, key: "seriesInLibrary", title: t("profile.stats.seriesInLibrary"), value: numberFormatter.format(stats.seriesInLibrary) },
    { icon: Film, key: "moviesInLibrary", title: t("profile.stats.moviesInLibrary"), value: numberFormatter.format(stats.moviesInLibrary) },
  ];

  return (
    <section className="mb-6">
      <h2 className="mb-3 px-1 text-lg font-bold text-text">{t("profile.statistics")}</h2>
      <div
        className={
          "-mx-4 flex gap-3 overflow-x-auto scroll-smooth px-4 pb-1 snap-x snap-mandatory " +
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        }
      >
        {cards.map((card) => (
          <StatCard key={card.key} icon={card.icon} title={card.title} value={card.value} subtext={card.subtext} />
        ))}
      </div>
    </section>
  );
}

/** Wrapper pra manter o call site antigo (`<MyStatsCarousel />`, sem props) funcionando no Perfil próprio. */
export function MyStatsCarousel() {
  const { data: stats, isLoading, isError } = useProfileStats();
  return <StatsCarousel stats={stats} isLoading={isLoading} isError={isError} ownerLabel="own" />;
}
