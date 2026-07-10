"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLibraryItems } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { SERIES_CATEGORIES } from "@/lib/series-categories";
import { PosterGrid } from "./PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";

/**
 * TASK-029 — "continuar suportando grade, lista, filtros". As
 * categorias por status (Assistindo/Concluídas/etc.) já funcionavam
 * como o filtro; o que faltava era o modo lista, adicionado aqui
 * reaproveitando `ViewModeToggle`/`MediaListRow` (já existentes,
 * usados em Séries → Minha Lista) — escopo próprio
 * ("profile-series"), não interfere na preferência de "Séries" nem
 * de "Filmes" no menu principal.
 */
export function ProfileSeriesSection() {
  const { data: items } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("profile-series");

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  const nonEmptyCategories = useMemo(
    () =>
      SERIES_CATEGORIES.map((category) => ({
        ...category,
        items: series.filter(category.filter),
      })).filter((category) => category.items.length > 0),
    [series]
  );

  if (nonEmptyCategories.length === 0) {
    return <p className="px-1 text-sm text-muted">Você ainda não tem nenhuma série na sua biblioteca.</p>;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      <div className="space-y-6">
        {nonEmptyCategories.map((category) => (
          <div key={category.slug}>
            <Link href={`/profile/series/${category.slug}`} className="block">
              <SectionTitle>{category.label}</SectionTitle>
            </Link>
            {viewMode === "grid" ? (
              <PosterGrid items={category.items} barColorClass={category.barColorClass} />
            ) : (
              <div className="space-y-2">
                {category.items.map((item) => (
                  <MediaListRow
                    key={item.id}
                    item={item}
                    secondaryText={
                      item.progress && item.progress.totalEpisodes > 0
                        ? `${item.progress.watchedEpisodes}/${item.progress.totalEpisodes} episódios`
                        : ""
                    }
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
