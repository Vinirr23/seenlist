"use client";

import { useEffect, useMemo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { useTranslation } from "@/lib/i18n/LocaleProvider";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { EmptyShelf } from "../media/EmptyShelf";
import { PageError } from "../media/PageError";
import { HomeSkeleton } from "../media/HomeSkeleton";
import { todayLocalKey, isReleased } from "./release-date";

interface Category {
  slug: string;
  label: string;
  items: LibraryItem[];
  emptyMessage: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

/**
 * CORREÇÃO (a pedido, "diverge do web de propósito" — o app nativo
 * já resolveu isso antes, TASK-099/TASK-148) — duas mudanças, mesma
 * origem: filme não tem um estado "assistindo" que faça sentido
 * mostrar como lista própria — diferente de série, não tem
 * episódio/progresso pra acompanhar aos poucos; um filme é "quero
 * assistir" ou já foi assistido (o que já muda o status pra
 * "completed" sozinho). Categoria "Assistindo" removida.
 *
 * Segunda mudança: um filme em "Assistir depois" com lançamento no
 * FUTURO saía misturado junto com os já lançados — agora sai daqui
 * e vai pra "Em breve" (`EmBreveSection.tsx`) automaticamente, sem
 * precisar de nada manual.
 *
 * "Concluídos" continua igual — não fazia parte do pedido.
 *
 * Mesmos hooks de sempre — nenhuma mudança de dados ou lógica além
 * do filtro dessas duas categorias.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { data: items, isLoading, isError, error, refetch } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("movies-library");
  const { t } = useTranslation();

  useEffect(() => {
    if (isError) {
      console.error("[MoviesHome/MinhaListaSection] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  const movies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);
  const todayKey = useMemo(() => todayLocalKey(), []);

  const wantToWatch = useMemo(
    () => movies.filter((item) => item.status === "want_to_watch" && isReleased(item.releaseDate, todayKey)),
    [movies, todayKey]
  );
  const completed = useMemo(() => movies.filter((item) => item.status === "completed"), [movies]);

  if (isLoading) return <HomeSkeleton />;
  if (isError) {
    return <PageError message={t("seriesHome.errorLoadLibrary")} onRetry={() => refetch()} />;
  }

  const categories: Category[] = [
    { slug: "watchlist", label: t("seriesHome.watchlist"), items: wantToWatch, emptyMessage: t("seriesHome.emptyWatchlist") },
    { slug: "completed", label: t("moviesHome.completed"), items: completed, emptyMessage: t("moviesHome.emptyCompleted") },
  ];

  return (
    <>
      <div className="mb-2 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category.slug}>
            <SectionTitle>{category.label}</SectionTitle>
            {category.items.length === 0 ? (
              <EmptyShelf
                message={category.emptyMessage}
                actionLabel={category.emptyActionLabel}
                actionHref={category.emptyActionHref}
              />
            ) : viewMode === "grid" ? (
              <PosterGrid items={category.items} />
            ) : (
              <div className="space-y-2">
                {category.items.map((item) => (
                  <MediaListRow key={item.id} item={item} secondaryText={item.year ? String(item.year) : ""} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
