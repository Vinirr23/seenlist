"use client";

import { useMemo } from "react";
import { useLibraryItems } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { PosterGrid } from "./PosterGrid";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";

/**
 * TASK-024 — só filmes "Assistido" (status "completed"), sem
 * categorias, sem barra de cor. TASK-029 — "mesmo comportamento da
 * tela atual" mantido; só adicionado o modo lista (mesmo padrão da
 * TASK-029 em ProfileSeriesSection.tsx), escopo próprio
 * ("profile-movies").
 */
export function ProfileMoviesSection() {
  const { data: items } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("profile-movies");

  const watchedMovies = useMemo(
    () => (items ?? []).filter((item) => item.mediaType === "movie" && item.status === "completed"),
    [items]
  );

  if (watchedMovies.length === 0) {
    return <p className="px-1 text-sm text-muted">Você ainda não assistiu nenhum filme.</p>;
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === "grid" ? (
        <PosterGrid items={watchedMovies} />
      ) : (
        <div className="space-y-2">
          {watchedMovies.map((item) => (
            <MediaListRow key={item.id} item={item} secondaryText={item.year ? String(item.year) : ""} />
          ))}
        </div>
      )}
    </section>
  );
}
