"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * TASK-023 (ajuste), item 3: em vez de mostrar todos os pôsteres de
 * "Assistir depois" na Home, um botão único que leva pra tela
 * dedicada (`/series/watchlist`).
 */
export function WatchlistButton() {
  const { t } = useTranslation();
  return (
    <Link
      href="/series/watchlist"
      className="mb-2 flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-4 text-sm font-semibold text-text transition-colors hover:border-primary/50"
    >
      {t("seriesHome.viewAllWatchlist")}
      <ChevronRight className="h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
    </Link>
  );
}
