"use client";

import { useUserStats } from "@/lib/queries/user-stats";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function ProfileStats() {
  const { data: stats, isLoading, isError } = useUserStats();
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3" aria-busy="true" aria-label={t("profile.loadingStats")}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded-lg border border-border bg-surface" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <p className="text-sm text-muted">{t("profile.errorLoadStats")}</p>
    );
  }

  const items = [
    { key: "moviesWatched", label: t("profile.stats.moviesWatched"), value: stats.moviesWatched },
    { key: "seriesWatched", label: t("profile.stats.seriesCompleted"), value: stats.seriesWatched },
    { key: "episodesWatched", label: t("profile.stats.episodesWatched"), value: stats.episodesWatched },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.key} className="rounded-lg border border-border bg-surface p-3 text-center">
          <p className="text-lg font-semibold text-text">{item.value}</p>
          <p className="text-[11px] text-muted">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
