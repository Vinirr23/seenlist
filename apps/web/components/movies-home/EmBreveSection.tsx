"use client";

import { useMemo } from "react";
import { useLibraryItems } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";
import { PosterGrid } from "../profile/PosterGrid";
import { EmptyShelf } from "../media/EmptyShelf";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";
import { todayLocalKey, isReleased, upcomingLabel } from "./release-date";

/**
 * CORREÇÃO (a pedido) — era um placeholder de propósito (comentário
 * original: "filme não tem uma data de estreia futura recorrente do
 * mesmo jeito que série tem"). O app nativo já tinha resolvido isso
 * de outro jeito (TASK-148): filme "Assistir depois" com lançamento
 * no futuro sai de "Minha Lista" e aparece aqui, ordenado por data
 * de lançamento — sem precisar de nada manual. Porta fiel dessa
 * lógica (`release-date.ts`, compartilhado com `MinhaListaSection`).
 */
export function EmBreveSection() {
  const { data: items, isLoading, isError, refetch } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("movies-library");
  const { t, locale } = useTranslation();

  const todayKey = useMemo(() => todayLocalKey(), []);

  const upcoming = useMemo(() => {
    return (items ?? [])
      .filter((item) => item.mediaType === "movie" && item.status === "want_to_watch" && !isReleased(item.releaseDate, todayKey))
      .sort((a, b) => (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""));
  }, [items, todayKey]);

  if (isLoading) return <HomeSkeleton />;
  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {upcoming.length === 0 ? (
        <EmptyShelf message={t("moviesHome.emptyUpcoming")} />
      ) : viewMode === "grid" ? (
        <PosterGrid items={upcoming} />
      ) : (
        <div className="space-y-2">
          {upcoming.map((item) => (
            <MediaListRow
              key={item.id}
              item={item}
              secondaryText={item.releaseDate ? upcomingLabel(item.releaseDate, todayKey, t, locale) : ""}
            />
          ))}
        </div>
      )}
    </>
  );
}
