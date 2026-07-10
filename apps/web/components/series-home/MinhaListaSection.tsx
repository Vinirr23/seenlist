"use client";

import { useEffect, useMemo } from "react";
import { useLibraryItems, useLibraryRealtimeSync } from "@/lib/queries/library";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { ContinueWatchingCard } from "./ContinueWatchingCard";
import { PosterGrid } from "../profile/PosterGrid";
import { SectionTitle } from "../media/SectionTitle";
import { WatchlistButton } from "./WatchlistButton";
import { EmptyShelf } from "./EmptyShelf";
import { HomeSkeleton } from "../media/HomeSkeleton";

const CONTINUE_ASSISTINDO_LIMIT = 8;

/**
 * Ajuste — o botão de alternância grade/lista mora aqui agora
 * (canto superior direito, junto do "Continue assistindo"). Escopo
 * próprio (`useViewModePreference("series-library")`) — trocar aqui
 * nunca afeta Filmes nem o Perfil, que têm sua própria preferência
 * independente.
 *
 * Mesmos hooks de sempre (`useLibraryItems`, `useLibraryRealtimeSync`)
 * — nada mudou na lógica de status, no banco, ou no tracker. Só a
 * apresentação de "Continue assistindo" alterna entre grade
 * (`PosterGrid`) e lista (`MediaListRow`) — a prateleira de scroll
 * horizontal que existia antes era o modo "grade" implícito; agora é
 * uma escolha explícita, com uma alternativa de verdade ao lado.
 */
export function MinhaListaSection() {
  useLibraryRealtimeSync();
  const { data: items, isLoading, isError, error } = useLibraryItems();
  const { viewMode, setViewMode } = useViewModePreference("series-library");

  useEffect(() => {
    if (isError) {
      console.error("[MinhaListaSection] useLibraryItems() falhou", error);
    }
  }, [isError, error]);

  const series = useMemo(() => (items ?? []).filter((item) => item.mediaType === "series"), [items]);

  const continueWatching = useMemo(
    () =>
      series
        .filter((item) => item.status === "watching")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, CONTINUE_ASSISTINDO_LIMIT),
    [series]
  );

  if (isError) {
    return <EmptyShelf message="Não foi possível carregar sua biblioteca agora. Tente de novo em instantes." />;
  }

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <SectionTitle>Continue assistindo</SectionTitle>
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {isLoading ? (
        <HomeSkeleton />
      ) : continueWatching.length === 0 ? (
        <EmptyShelf
          message="Você ainda não está acompanhando nenhuma série."
          actionLabel="Explorar séries"
          actionHref="/explore"
        />
      ) : viewMode === "grid" ? (
        <PosterGrid items={continueWatching} />
      ) : (
        <div className="space-y-3">
          {continueWatching.map((item) => (
            <ContinueWatchingCard key={item.id} item={item} />
          ))}
        </div>
      )}

      <div className="mt-4">
        <WatchlistButton />
      </div>
    </>
  );
}
