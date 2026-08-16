"use client";

import { memo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { MediaShelf } from "./MediaShelf";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

export interface CompletedSectionProps {
  items: LibraryItem[];
  isLoading: boolean;
}

/** TASK-022, item 4 — nova seção (a versão anterior já tinha "Concluídas", mantida/organizada aqui). */
export const CompletedSection = memo(function CompletedSection({ items, isLoading }: CompletedSectionProps) {
  const { t } = useTranslation();
  return (
    <MediaShelf title={t("seriesHome.completed")} items={items} isLoading={isLoading} emptyMessage={t("seriesHome.emptyCompleted")} />
  );
});
