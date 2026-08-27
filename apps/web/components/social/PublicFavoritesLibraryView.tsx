"use client";

import { useMemo } from "react";
import type { MediaType } from "@seenlist/types";
import { usePublicFavorites } from "@/lib/queries/favorites";
import { useViewModePreference } from "@/lib/view-mode/useViewModePreference";
import { PosterGrid } from "@/components/profile/PosterGrid";
import { ViewModeToggle } from "@/components/media/ViewModeToggle";
import { MediaListRow } from "@/components/media/MediaListRow";
import { PageError } from "@/components/media/PageError";
import { useTranslation } from "@/lib/i18n/LocaleProvider";

/**
 * Mesma ideia de `FavoritesLibraryView.tsx` (Perfil próprio) —
 * compartilhado entre "Séries favoritas" e "Filmes favoritos" via
 * `mediaType`, só que lendo os favoritos de OUTRO usuário (`userId`
 * explícito, não o usuário logado) e com `PosterGrid`
 * `interactive={false}` — diferente do Perfil próprio, aqui é a
 * biblioteca de outra pessoa, não faz sentido poder mudar status
 * direto daqui.
 */
export function PublicFavoritesLibraryView({
  userId,
  mediaType,
  viewModeScope,
}: {
  userId: string;
  mediaType: MediaType;
  viewModeScope: string;
}) {
  const { data: favorites, isLoading, isError, refetch } = usePublicFavorites(userId);
  const { viewMode, setViewMode } = useViewModePreference(viewModeScope);
  const { t } = useTranslation();

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
    return <PageError message={t("social.errorLoadPublicLibrary")} onRetry={() => refetch()} />;
  }

  if (items.length === 0) {
    return <p className="px-1 text-sm text-muted">{t("social.emptyPublicLibrary")}</p>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <ViewModeToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
      {viewMode === "grid" ? (
        <PosterGrid items={items} interactive={false} />
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
