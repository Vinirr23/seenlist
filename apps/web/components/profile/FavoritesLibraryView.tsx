"use client";

import { useMemo } from "react";
import type { MediaType } from "@seenlist/types";
import { useCurrentUser } from "@/lib/queries/current-user";
import { usePublicFavorites } from "@/lib/queries/favorites";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { PosterGrid } from "./PosterGrid";
import { ViewModeToggle } from "../media/ViewModeToggle";
import { MediaListRow } from "../media/MediaListRow";

/**
 * TASK-029 — reaproveita `usePublicFavorites` (já existia, usado no
 * perfil público de outra pessoa) passando o ID do PRÓPRIO usuário —
 * a policy de RLS já garante que o dono sempre vê os próprios
 * favoritos, então não precisou de nenhuma query nova pra isso.
 * Compartilhado entre "Séries favoritas" e "Filmes favoritos" via
 * `mediaType`, em vez de duplicar o mesmo componente duas vezes.
 *
 * `PosterGrid` fica com pressionar-e-segurar HABILITADO (padrão) —
 * diferente do perfil público de outra pessoa, aqui é a biblioteca
 * do próprio usuário, faz sentido poder mudar status direto daqui.
 */
export function FavoritesLibraryView({ mediaType, viewModeScope }: { mediaType: MediaType; viewModeScope: string }) {
  const { data: user } = useCurrentUser();
  const { data: favorites, isLoading, isError } = usePublicFavorites(user?.id ?? null);
  const { viewMode, setViewMode } = useViewModePreference(viewModeScope);

  const items = useMemo(
    () => (favorites ?? []).filter((item) => item.mediaType === mediaType),
    [favorites, mediaType]
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2" aria-busy="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] w-full animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <p className="px-1 text-sm text-muted">Não foi possível carregar seus favoritos agora.</p>;
  }

  if (items.length === 0) {
    return (
      <p className="px-1 text-sm text-muted">
        {mediaType === "series"
          ? "Você ainda não favoritou nenhuma série."
          : "Você ainda não favoritou nenhum filme."}
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === "grid" ? (
        <PosterGrid items={items} />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <MediaListRow key={item.id} item={item} secondaryText={item.year ? String(item.year) : ""} />
          ))}
        </div>
      )}
    </div>
  );
}
