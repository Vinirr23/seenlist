"use client";

import { useEffect, useMemo } from "react";
import type { LibraryItem } from "@seenlist/types";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { HomeEmptyState } from "../media/HomeEmptyState";
import { HomeSkeleton } from "../media/HomeSkeleton";

interface Category {
  label: string;
  items: LibraryItem[];
  emptyMessage: string;
  emptyActionLabel?: string;
  emptyActionHref?: string;
}

/**
 * Ajuste — mesmo toggle de Séries, escopo próprio
 * (`useViewModePreference("movies-library")`) — nunca afeta Séries
 * nem Perfil. Um botão só, no topo, alterna as 3 seções juntas
 * (Assistindo/Assistir depois/Concluídos), já que são a mesma
 * "biblioteca de filmes" pedida na tarefa.
 *
 * Mesmos hooks de sempre — nenhuma mudança de dados ou lógica.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { data: items, isLoading, isError, error } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("movies-library");

  useEffect(() => {
    if (isError) {
      console.error("[MoviesHome/MinhaListaSection] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  const movies = useMemo(() => (items ?? []).filter((item) => item.mediaType === "movie"), [items]);

  const watching = useMemo(
    () => movies.filter((item) => item.status === "watching").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [movies]
  );
  const wantToWatch = useMemo(() => movies.filter((item) => item.status === "want_to_watch"), [movies]);
  const completed = useMemo(() => movies.filter((item) => item.status === "completed"), [movies]);

  if (isLoading) return <HomeSkeleton />;
  if (isError) {
    return <HomeEmptyState message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />;
  }

  const categories: Category[] = [
    {
      label: "Assistindo",
      items: watching,
      emptyMessage: "Você ainda não adicionou nenhum filme.",
      emptyActionLabel: "Explorar filmes",
      emptyActionHref: "/explore",
    },
    { label: "Assistir depois", items: wantToWatch, emptyMessage: "Sua lista está vazia." },
    { label: "Concluídos", items: completed, emptyMessage: "Nenhum filme concluído ainda." },
  ];

  return (
    <>
      <div className="mb-2 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <section key={category.label}>
            <SectionTitle>{category.label}</SectionTitle>
            {category.items.length === 0 ? (
              <HomeEmptyState
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
