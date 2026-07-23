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

  /**
   * Correção (bug real, reportado): "Em dia" (`up_to_date`) é um status
   * PRÓPRIO, separado de "watching" — mesma causa raiz já documentada
   * em `useUpcomingEpisodes`/"Em breve". Filtrando só "watching" aqui,
   * uma série que já estava em dia sumia de "Continue assistindo" pra
   * sempre, mesmo quando saía episódio novo — nunca tinha chance de
   * mostrar o card (e o selo NOVO) de novo, porque nada no web
   * recalcula essa categoria sozinho (diferente do app nativo, que
   * refaz esse recálculo toda vez que a aba ganha foco — decisão
   * documentada como só-nativo na época, não portada pro web).
   *
   * Ampliado só pro modo LISTA: é o único lugar que mostra o selo
   * NOVO (`ContinueWatchingCard`, que já sabe voltar `null` sozinho
   * quando a série em dia não tem episódio pendente nenhum — nada
   * aparece à toa). O modo GRADE (`PosterGrid`) não filtra nem mostra
   * selo nenhum — incluir "Em dia" ali poluiria "Continue assistindo"
   * com séries sem nada pendente, então esse continua só "watching".
   */
  const continueWatchingList = useMemo(
    () =>
      series
        .filter((item) => item.status === "watching" || item.status === "up_to_date")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, CONTINUE_ASSISTINDO_LIMIT),
    [series]
  );

  const continueWatchingGrid = useMemo(
    () =>
      series
        .filter((item) => item.status === "watching")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, CONTINUE_ASSISTINDO_LIMIT),
    [series]
  );

  const continueWatching = viewMode === "grid" ? continueWatchingGrid : continueWatchingList;

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
