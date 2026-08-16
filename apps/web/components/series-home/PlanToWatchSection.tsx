"use client";

import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { MediaShelf } from "./MediaShelf";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface PlanToWatchSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

export const PlanToWatchSection = memo(function PlanToWatchSection({ items, isLoading }: PlanToWatchSectionProps) {
  const { t } = useTranslation();
  return <MediaShelf title={t("seriesHome.watchlist")} items={items} isLoading={isLoading} emptyMessage={t("seriesHome.emptyWatchlist")} />;
});
