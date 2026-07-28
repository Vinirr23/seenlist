"use client";

import type { LibraryItem } from "@seenlist/types";
import { LibraryCard } from "./LibraryCard";
import { ProgressBar } from "../media/ProgressBar";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export function LibrarySeriesCard({ item }: { item: LibraryItem }) {
  const watched = item.progress?.watchedEpisodes ?? 0;
  const total = item.progress?.totalEpisodes ?? 0;
  const percentage = total > 0 ? Math.round((watched / total) * 100) : 0;
  const { t } = useTranslation();

  return (
    <LibraryCard item={item}>
      <div className="space-y-1">
        <ProgressBar percentage={percentage} />
        <p className="text-[11px] text-muted">{t("seriesHome.episodeProgress", { watched, total })}</p>
      </div>
    </LibraryCard>
  );
}
