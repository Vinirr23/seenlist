import { useMemo } from "react";
import { usePublicLibraryItems } from "./public-library";
import { computeProfileStats, type ProfileStats } from "./profile-stats";

/**
 * TASK-028, item 5 — mesmas 8 estatísticas do carrossel pessoal,
 * calculadas em cima de `usePublicLibraryItems` (que já respeita a
 * visibilidade da biblioteca do usuário-alvo via RLS). Reaproveita
 * `computeProfileStats` — nenhuma lógica de agregação duplicada.
 */
export function usePublicStats(userId: string | null) {
  const libraryQuery = usePublicLibraryItems(userId);

  const stats = useMemo<ProfileStats | undefined>(() => {
    if (!libraryQuery.data) return undefined;
    return computeProfileStats(libraryQuery.data);
  }, [libraryQuery.data]);

  return { ...libraryQuery, data: stats };
}
