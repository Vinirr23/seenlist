"use client";

import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { MediaShelf } from "./MediaShelf";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface WatchingSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

export const WatchingSection = memo(function WatchingSection({ items, isLoading }: WatchingSectionProps) {
  const { t } = useTranslation();
  return <MediaShelf title={t("library.tab.watching")} items={items} isLoading={isLoading} emptyMessage={t("seriesHome.emptyWatching")} />;
});
